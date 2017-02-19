/**
 * @file
 * CKEditor plugin to display TMGMT segments.
 */

(function ($, Drupal, debounce, CKEDITOR) {
  'use strict';

  var constants = {
    main: {
      tmgmtSegments: 'tmgmt-segment',
      tmgmtTags: 'tmgmt-tag'
    },
    attribute: {
      statusCompleted: 'data-tmgmt-segment-completed-status',
      statusActive: 'data-tmgmt-segment-active-status',
      source: 'data-tmgmt-segment-source',
      quality: 'data-tmgmt-segment-quality',
      hasMissingTags: 'data-tmgmt-segment-missing-tags',
      segmentsInfoArea: 'data-tmgmt-segment-info-area'
    },
    class: {
      reviewPage: 'tmgmt-ui-review',
      validationWrapper: 'tmgmt-segment-validation-div messages messages--error',
      validationTagsWrapper: 'tmgmt-segment-validation-tags-div',
      globalCounterWrapper: 'tmgmt-segment-validation-global-counter-div',
      missingTagsGlobalCounter: 'segment-validation-missing-tags-global-counter',
      missingTagsCounter: 'segment-validation-missing-tags',
      segmentsMismatchWrapper: 'tmgmt-segment-validation-segments-mismatch-div',
      segmentsMismatch: 'segment-validation-segments-mismatch',
      noSuggestedTranslationsWrapper: 'no-suggested-translations-wrapper',
      noSuggestedTranslations: 'no-suggested-translations',
      suggestedTranslations: 'suggested-translations',
      activeSegmentWrapper: 'tmgmt-active-segment-wrapper',
      activeSegment: 'tmgmt-active-segment',
      segmentStatusCounter: 'segment-status-counter',
      missingTagsWrapper: 'tmgmt-missing-tags-wrapper',
      translationSuggestions: 'tmgmt-translation-suggestions'
    },
    id: {
      buttonUseSuggestionId: 'btn-use-suggestion-'
    }
  };

  var enableListener = false;
  var editorPairs = [];
  var wrappers = [].slice.call(document.getElementsByClassName('tmgmt-ui-data-item-translation')).splice(1, 3);
  var activeEditorId;
  var languageFile;

  var commandDefinition = {
    readOnly: 1,
    preserveState: true,
    editorFocus: false,

    exec: function (editor) {
      this.toggleState();
      this.refresh(editor);
      var relatedEditor = getRelatedEditor(editor);
      relatedEditor.commands.showsegments.toggleState();
    },

    refresh: function (editor) {
      if (editor.document) {
        // showSegments turns inactive after editor loses focus when in inline.
        var showSegments = (this.state === CKEDITOR.TRISTATE_ON &&
        (editor.elementMode !== CKEDITOR.ELEMENT_MODE_INLINE || editor.focusManager.hasFocus));

        var matchId = editor.name.match(/\d+/);
        activeEditorId = parseInt(matchId[0], 10);
        var relatedEditor = getRelatedEditor(editor);

        languageFile = editor.lang.tmgmt_segments;

        var funcName = showSegments ? 'attachClass' : 'removeClass';
        editor.editable()[funcName]('cke_show_segments');

        // Display segments also in the related editor.
        relatedEditor.editable()[funcName]('cke_show_segments');

        // Display the segments' content below the translate editor if the
        // plugin is enabled.
        if (showSegments) {
          // Set the active editor name.
          editorPairs[activeEditorId].activeEditorName = editor.name;

          // Set the flag for the keystrokes listeners to enabled.
          enableListener = true;

          // This check is because when clicking "Use", the editors
          // refresh, but the status is still active and it adds a new div.
          if (editorPairs[activeEditorId].areaBelow.innerHTML === '') {
            if (editor.addMenuItem) {
              // A group menu is required.
              editor.addMenuGroup('setStatusGroup');

              // Create a context menu item.
              editor.addMenuItem('setStatusItem', {
                label: languageFile.setCompletedStatusTitle,
                icon: CKEDITOR.plugins.get('tmgmt_segments').path + 'icons/status-completed.png',
                command: 'setStatusCompleted',
                group: 'setStatusGroup'
              });
            }
          }

          var editable = editor.editable();
          editable.focus();

          // Things to do when a word/segment is clicked.
          editable.attachListener(editable, 'click', function (evt) {
            if (activeEditorId !== editorPairs[activeEditorId].id) {
              // Remove the area below when changing editor.
              editorPairs[activeEditorId].areaBelow.innerHTML = '';
            }
            // Set the editorPairs[activeEditorId].id to the newly clicked editor's id.
            refreshActiveContent();
          });

          if (document.getElementById('sidebar')) {
            document.getElementById('sidebar').style.display = 'block';
          }
          else {
            var stickyDiv = document.createElement('div');
            stickyDiv.id = 'sidebar';
            document.getElementsByClassName('region-content')[0].appendChild(stickyDiv);
          }

          // Set the counter in the sidebar.
          setCounterCompletedSegments();
          // Check for tag validation.
          EditorPair.prototype.tagValidation();
        }
        // Remove the segments display area below the editor when we disable
        // the plugin.
        else {
          editorPairs[activeEditorId].areaBelow.innerHTML = '';
          // Remove the context menu item.
          editor.removeMenuItem('setStatusItem');
          if (document.getElementById('sidebar')) {
            document.getElementById('sidebar').style.display = 'none';
          }
        }
      }
    }
  };

  CKEDITOR.plugins.add('tmgmt_segments', {
    lang: 'en',
    icons: 'showsegments',
    hidpi: true,
    allowedContent: 'tmgmt-segment[id,data-tmgmt-segment-completed-status,data-tmgmt-segment-active-status,data-tmgmt-segment-source,data-tmgmt-segment-quality]; tmgmt-segment[id,data-tmgmt-segment-completed-status,data-tmgmt-segment-active-status,data-tmgmt-segment-source,data-tmgmt-segment-quality] tmgmt-tag[!element,!raw];',
    requires: 'widget',
    onLoad: function () {
      var cssStd;
      var cssImgLeft;
      var cssImgRight;

      cssStd = cssImgLeft = cssImgRight = '';

      cssStd += '.cke_show_segments ' + constants.main.tmgmtSegments + '{' +
        '}';
      cssImgLeft += '.cke_show_segments ' + constants.main.tmgmtSegments + '::before{' +
        'content:' + '"\u25B6"' + ';' + 'padding-right: 0.5em;' +
        '}';
      cssImgRight += '.cke_show_segments ' + constants.main.tmgmtSegments + '::after{' +
        'content:' + '"\u25C0"' + ';' + 'padding-left: 0.5em;' +
        '}';

      CKEDITOR.addCss(cssStd.concat(cssImgLeft, cssImgRight));
    },

    beforeInit: function (editor) {
      // Configure CKEditor DTD for custom drupal-url element.
      // @see https://www.drupal.org/node/2448449#comment-9717735
      var dtd = CKEDITOR.dtd;
      var tagName;
      dtd[constants.main.tmgmtSegments] = {
        '#': 1,
        'span': 1,
        'tmgmt-tag': 1
      };

      dtd.$block[constants.main.tmgmtSegments] = 1;
      dtd[constants.main.tmgmtSegments][constants.main.tmgmtTags] = 1;
      dtd[constants.main.tmgmtTags] = {};
      for (tagName in dtd) {
        if (dtd[tagName].img) {
          dtd[tagName][constants.main.tmgmtTags] = 1;
        }
      }

      editor.widgets.add('tmgmt_tags', {
        inline: true,
        allowedContent: 'tmgmt-tag[element,raw]',
        requiredContent: 'tmgmt-tag[element,raw]',

        editables: {
          content: {
            selector: constants.main.tmgmtTags
          }
        },

        upcast: function (element) {
          return element.name === constants.main.tmgmtTags;
        }
      });
    },

    init: function (editor) {
      if (editor.blockless) {
        return;
      }

      // Load the plugin only on translate/review pages.
      // This is a really bad solution! CHANGE THIS!
      if (document.getElementsByClassName(constants.class.reviewPage).length === 0) {
        return;
      }

      var command = editor.addCommand('showsegments', commandDefinition);
      command.canUndo = false;

      if (editor.config.startupOutlineBlocks) {
        command.setState(CKEDITOR.TRISTATE_ON);
      }

      editor.ui.addButton && editor.ui.addButton('tmgmt_segments', {
        icon: 'showsegments',
        label: editor.lang.tmgmt_segments.buttonTitle,
        command: 'showsegments',
        toolbar: 'tools,20'
      });

      if (editor.contextMenu) {
        editor.contextMenu.addListener(function (element) {
          if (element.getAscendant(constants.main.tmgmtSegments, true)) {
            return {
              setStatusItem: CKEDITOR.TRISTATE_ON
            };
          }
        });
      }

      // Command for the context menu.
      editor.addCommand('setStatusCompleted', {
        exec: function (editor) {
          var element = editor.getSelection().getStartElement();
          element.setAttribute(constants.attribute.statusCompleted, 'completed');
          // If the clicked element is the segment, set the id.
          if (element.getName() === constants.main.tmgmtSegments) {
            editorPairs[activeEditorId].activeSegmentId = element.getId();
          }
          // If the clicked element is the tag, get the id from the parent.
          else if (element.getName() === constants.main.tmgmtTags) {
            editorPairs[activeEditorId].activeSegmentId = element.getParent().getId();
          }
          markSegment('completed');

          setCounterCompletedSegments();
        }
      });

      editor.on('instanceReady', function () {
        var translationNameMatch = editor.name.match(/.*value-translation-value$/);
        // Get the editor id.
        var editorMatchId = editor.name.match(/\d+/);
        var editorId = parseInt(editorMatchId[0], 10);
        var sourceEditor = getRelatedEditor(editor);

        // When the data is loaded and the translation editor is empty, populate
        // the content with the corresponding source content.
        if (translationNameMatch != null) {
          var segmentsDiv = document.createElement('div');
          segmentsDiv.className = 'tmgmt-segments segment-pair-' + editorId;
          wrappers[editorId].appendChild(segmentsDiv);
          if (!editor.getData()) {
            editor.setData(sourceEditor.getData());
            wrappers[editorId].setAttribute(constants.attribute.segmentsInfoArea, editorId);
          }

          // Create an array of editor pairs.
          editorPairs[editorId] = new EditorPair(editorId, sourceEditor, editor, segmentsDiv);
        }
      });

      // Refresh the command on focus/blur in inline.
      if (editor.elementMode === CKEDITOR.ELEMENT_MODE_INLINE) {
        editor.on('focus', onFocusBlur);
        editor.on('blur', onFocusBlur);
      }

      // Refresh the command on setData.
      editor.on('contentDom', function () {
        if (command.state !== CKEDITOR.TRISTATE_DISABLED) {
          command.refresh(editor);
        }
      });

      // Refresh the editor when the plugin is enabled.
      // This is mainly because after toggling Source in the editor the segments
      // are not displayed.
      editor.on('mode', function () {
        if (command.state === CKEDITOR.TRISTATE_ON) {
          command.refresh(editor);
        }
      });

      // Set the source data attribute to user if the user changes it manually.
      editor.on('change', debounce(function () {
        // Exit from function when the flag is true. This is set when adding a
        // segment from the memory (clicking the button).
        if (enableListener == false) {
          return;
        }
        refreshActiveContent();
      }, 1200));

      function onFocusBlur() {
        command.refresh(editor);
      }
    }
  });

  /**
   * Structure for the EditorPair object.
   *
   * @param id
   *   Id of the current editor.
   * @param leftEditor
   *   The left editor of the editor pair.
   * @param rightEditor
   *   The right editor of the editor pair.
   * @param areaBelow
   *   The area below the current editor pair.
   * @param activeEditorName
   *   The active editor's name.
   * @param activeSegmentId
   *   The active segment's id.
   * @param activeWord
   *   The active word.
   * @param activeTag
   *   The active tag.
   * @param counter
   *   The counter of completed segments.
   * @param editor
   *   Full editor object.
   * @constructor
   */
  function EditorPair(id, leftEditor, rightEditor, areaBelow, activeEditorName, activeSegmentId, activeWord, activeTag, counter, editor) {
    this.id = id;
    this.leftEditor = leftEditor;
    this.rightEditor = rightEditor;
    this.areaBelow = areaBelow;
    this.activeEditorName = activeEditorName;
    this.activeSegmentId = activeSegmentId;
    this.activeWord = activeWord;
    this.activeTag = activeTag;
    this.completedCounter = counter;
    this.editor = editor;
  }

  /**
   * Get the difference in the number of tags for a selected segment.
   */
  EditorPair.prototype.tagValidation = function () {
    var segmentsLeft = editorPairs[activeEditorId].leftEditor.document.$.getElementsByTagName(constants.main.tmgmtSegments);
    var segmentsRight = editorPairs[activeEditorId].rightEditor.document.$.getElementsByTagName(constants.main.tmgmtSegments);
    var numberOfTagsPerSegmentLeft;
    var numberOfTagsPerSegmentRight;
    var arrayOfTagsPerSegmentLeft = [];
    var arrayOfTagsPerSegmentRight = [];
    var differences = [];
    var globalCounter = 0;
    var segmentsWithMissingTags = [];
    var validationWrapper;

    if (!document.getElementsByClassName(constants.class.validationWrapper)[0]) {
      validationWrapper = document.createElement('div');
      validationWrapper.className = constants.class.validationWrapper;
    }
    else {
      validationWrapper = document.getElementsByClassName(constants.class.validationWrapper)[0];
    }

    if (segmentsLeft.length === segmentsRight.length) {
      for (var i = 0; i < segmentsLeft.length; i++) {
        numberOfTagsPerSegmentLeft = segmentsLeft[i].getElementsByTagName(constants.main.tmgmtTags).length;
        numberOfTagsPerSegmentRight = segmentsRight[i].getElementsByTagName(constants.main.tmgmtTags).length;

        globalCounter += numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight;

        if (numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight !== 0 && (editorPairs[activeEditorId].activeSegmentId || _.contains(segmentsWithMissingTags, editorPairs[activeEditorId].activeSegmentId))) {
          segmentsWithMissingTags.push(segmentsLeft[i].id);
          if (editorPairs[activeEditorId].activeSegmentId === segmentsLeft[i].id) {
            markSegment('has-missing-tags');
            arrayOfTagsPerSegmentLeft = segmentsLeft[i].getElementsByTagName(constants.main.tmgmtTags);
            arrayOfTagsPerSegmentRight = segmentsRight[i].getElementsByTagName(constants.main.tmgmtTags);

            var tagsLeft = convertArrayToStrings(arrayOfTagsPerSegmentLeft);
            var tagsRight = convertArrayToStrings(arrayOfTagsPerSegmentRight);

            // If the left segment has more tags than the right one...
            if (numberOfTagsPerSegmentLeft > numberOfTagsPerSegmentRight) {
              differences = _.difference(tagsLeft, tagsRight);
              differences = convertArrayToOjbects(differences);
              if (differences.length === 1) {
                appendText(constants.class.validationTagsWrapper, numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight + ' ' + languageFile.oneMissingTag + ':', differences , editorPairs[activeEditorId].areaBelow, constants.class.missingTagsCounter, true);
              }
              else {
                appendText(constants.class.validationTagsWrapper, numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight + ' ' + languageFile.moreMissingTags + ':', differences , editorPairs[activeEditorId].areaBelow, constants.class.missingTagsCounter, true);
              }
            }
            // If the right segment has more tags than the left one.
            else {
              differences = _.difference(tagsRight, tagsLeft);
              differences = convertArrayToOjbects(differences);
              if (differences.length === 1) {
                appendText(constants.class.validationTagsWrapper, numberOfTagsPerSegmentRight - numberOfTagsPerSegmentLeft + ' ' + languageFile.oneExtraTag + ':', differences , editorPairs[activeEditorId].areaBelow, constants.class.missingTagsCounter, false);
              }
              else {
                appendText(constants.class.validationTagsWrapper, numberOfTagsPerSegmentRight - numberOfTagsPerSegmentLeft + ' ' + languageFile.moreExtraTags + ':', differences , editorPairs[activeEditorId].areaBelow, constants.class.missingTagsCounter, false);
              }
            }

            if (validationWrapper.innerHTML) {
              validationWrapper.innerHTML = '';
            }
            validationWrapper.appendChild(document.getElementsByClassName(constants.class.validationTagsWrapper)[0]);
          }
        }
      }

      // Global validation error message.
      if (globalCounter !== 0) {
        if (!editorPairs[activeEditorId].activeSegmentId || !_.contains(segmentsWithMissingTags, editorPairs[activeEditorId].activeSegmentId)) {
          if (!document.getElementsByClassName(constants.class.globalCounterWrapper)[0]) {
            appendText(constants.class.globalCounterWrapper, languageFile.missingTagsTitle, globalCounter, editorPairs[activeEditorId].areaBelow, constants.class.missingTagsGlobalCounter, false);
          }
          else {
            document.getElementsByClassName(constants.class.missingTagsGlobalCounter)[0].innerHTML = globalCounter;
          }
          validationWrapper.appendChild(document.getElementsByClassName(constants.class.globalCounterWrapper)[0]);
        }
      }
    }
    else {
      appendText(constants.class.segmentsMismatchWrapper, languageFile.numberOfSegmentsNotMatching, '', editorPairs[activeEditorId].areaBelow, constants.class.segmentsMismatch, false);
      validationWrapper.appendChild(document.getElementsByClassName(constants.class.segmentsMismatchWrapper)[0]);
    }

    // If we appended some warning message, append it to the area below.
    if (validationWrapper.innerHTML) {
      editorPairs[activeEditorId].areaBelow.appendChild(validationWrapper);
    }
  };

  /**
   * Convert an array of HTMLElement objects to strings for comparing.
   *
   * @param {Array} array
   *   Array of HTMLElement objects.
   * @return {Array}
   *   Array of tags as strings.
   */
  function convertArrayToStrings(array) {
    var arrayOfStrings = [];
    for (var i = 0; i < array.length; i++) {
      arrayOfStrings[i] = array[i].outerHTML;
    }
    return arrayOfStrings;
  }

  /**
   * Convert the array of differences back to HTML objects.
   *
   * @param {Array} array
   *   Array of tags as strings.
   * @return {Array}
   *   Array of HTMLElement objects.
   */
  function convertArrayToOjbects(array) {
    var arrayOfHTMLObjects = [];
    for (var i = 0; i < array.length; i++) {
      var d = document.createElement('div');
      d.innerHTML = array[i];
      arrayOfHTMLObjects[i] = d.firstChild;
    }
    return arrayOfHTMLObjects;
  }

  /**
   * Refresh the active content after the segment is selected.
   */
  function refreshActiveContent() {
    // Reset the active segment if one was already selected before.
    if (editorPairs[activeEditorId].activeSegmentId && editorPairs[activeEditorId].activeEditorName) {
      resetActiveSegment();
    }

    var selectedContent = getActiveContent();
    // If the segment is clicked, display it.
    if (selectedContent && selectedContent['sameSegment'] === false) {
      // Append the area below the current editor.
      appendAreaBelow();

      // Do the http request to the memory.
      getDataFromMemory(selectedContent);

      // Check for tag validation.
      EditorPair.prototype.tagValidation();
    }
    // If something else is clicked, remove the previously displayed segment.
    // @todo Do this in appendAreaBelow()?
    else if (selectedContent === null) {
      editorPairs[activeEditorId].areaBelow.innerHTML = '';
      // Check for tag validation.
      EditorPair.prototype.tagValidation();
    }
  }

  /**
   * Get the suggested translations from the tmgmt-memory.
   *
   * @param {Array} selectedContent
   *   Array of data about the selected segment.
   */
  function getDataFromMemory(selectedContent) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        displayActiveSegmentText();

        var jsonData = JSON.parse(xmlhttp.responseText);
        createTable(jsonData);
      }
      else if (xmlhttp.readyState == 4 && xmlhttp.status == 204) {
        var noSuggestionsWrapper = document.createElement('div');
        noSuggestionsWrapper.className = constants.class.noSuggestedTranslationsWrapper;
        editorPairs[activeEditorId].areaBelow.appendChild(noSuggestionsWrapper);

        var text = document.createElement('P');
        text.className = constants.class.noSuggestedTranslations;
        text.appendChild(document.createTextNode(languageFile.noTranslationsInMemory));
        noSuggestionsWrapper.appendChild(text);
      }
    };
    sendHttpRequest(xmlhttp, selectedContent);
  }

  /**
   * Display the selected segment in the area below.
   */
  function displayActiveSegmentText() {
    // Make a wrapper for suggested translations.
    var suggestedTranslations = document.createElement('div');
    suggestedTranslations.className = constants.class.suggestedTranslations;
    editorPairs[activeEditorId].areaBelow.appendChild(suggestedTranslations);

    var p1 = document.createElement('P');
    p1.className = constants.class.activeSegmentWrapper;
    p1.appendChild(document.createTextNode(languageFile.suggestedTranslationsTitle + ' '));
    var span = document.createElement('span');
    span.className = constants.class.activeSegment;
    span.appendChild(document.createTextNode('"' + editorPairs[activeEditorId].activeSegmentStrippedText + '"'));
    p1.appendChild(span);
    suggestedTranslations.appendChild(p1);
  }

  /**
   * Send the http request to the translation memory.
   *
   * @param {XMLHttpRequest} xmlhttp
   *   The XMLHttpRequest object.
   * @param {Array} selectedContent
   *   The array containing data about the selected content.
   */
  function sendHttpRequest(xmlhttp, selectedContent) {
    xmlhttp.open('GET', drupalSettings.path.baseUrl +
      'tmgmt_ckeditor/get.json?segmentStrippedText=' + selectedContent['segmentStrippedText'] +
      '&segmentHtmlText=' + encodeURIComponent(selectedContent['segmentHtmlText']) +
      '&lang_source=' + selectedContent['sourceLanguage'] +
      '&lang_target=' + selectedContent['targetLanguage'], true);
    xmlhttp.send();
  }

  /**
   * Get the selected segment, word and tag.
   *
   * @return {Array} activeSegmentData
   *   Array of data about the selected segment, word and tag.
   */
  function getActiveContent() {
    var range = CKEDITOR.currentInstance.getSelection().getRanges()[0];
    var clickedSegment = range.startContainer.getParent();

    // If we clicked the segment or the tag inside.
    if (range.startOffset && (clickedSegment.getName() === constants.main.tmgmtSegments || clickedSegment.getParent().getName() === constants.main.tmgmtSegments)) {

      var indexes = getClickedIndexes(range, clickedSegment);

      // If the clicked element was the tag, we need to get the parent.
      var activeSegmentData = [];
      if (clickedSegment.getName() === constants.main.tmgmtTags) {
        activeSegmentData['segmentId'] = clickedSegment.getParent().getAttribute('id');
        activeSegmentData['segmentStrippedText'] = clickedSegment.getParent().getText();
        // activeSegmentData['segmentHtmlText'] = clickedSegment.getParent().getHtml();

        // Regex to get the text inside masked tag pairs.
        var regexForTagPairs = new RegExp('<tmgmt-tag element=\"[a-z]+\".*>(.*)<tmgmt-tag element=\"\/[a-z]+\".*>', 'g');
        var clickedTag = clickedSegment.getOuterHtml();
        var textInsideTagPairs = regexForTagPairs.exec(clickedTag);
        regexForTagPairs.lastIndex = 0; // Reset the last index of regex (null issue).
        if (textInsideTagPairs) {
          activeSegmentData['tagsStrippedText'] = regexForTagPairs.exec(clickedTag)[1];
        }
      }
      else {
        activeSegmentData['segmentId'] = clickedSegment.getAttribute('id');
        activeSegmentData['segmentStrippedText'] = clickedSegment.getText();
        // activeSegmentData['segmentHtmlText'] = clickedSegment.getHtml();
        activeSegmentData['tagsStrippedText'] = null;
      }

      var editorData = CKEDITOR.currentInstance.getData();
      var clickedSegmentId = activeSegmentData['segmentId'];
      var regexForSegmentHtmlText = new RegExp('<tmgmt-segment.*? id=\"' + clickedSegmentId + '\">(.*?)<\/tmgmt-segment>');
      // regexForSegmentHtmlText.lastIndex = 0; // Reset the last index of regex (null issue).
      activeSegmentData['segmentHtmlText'] = regexForSegmentHtmlText.exec(editorData)[1];

      activeSegmentData['word'] = clickedSegment.getText().substring(indexes.indexPrevSpace, indexes.indexNextSpace).replace(/[.,:;!?]$/,'');
      activeSegmentData['sourceLanguage'] = drupalSettings.sourceLanguage;
      activeSegmentData['targetLanguage'] = drupalSettings.targetLanguage;

      // Set flag if the user clicked the same segment again.
      setSameSegmentFlag(activeSegmentData);

      setEditorPairData(activeSegmentData);
      markSegment('active');

      // Return the word without extra characters.
      return activeSegmentData;
    }
    // If we clicked outside of the segment, we reset the active segments and tags.
    setEditorPairData(null);
    return null;
  }

  /**
   * Get the indexes of the clicked segment.
   *
   * @param {CKEDITOR.dom.range} range
   *   Range of the clicked element.
   *
   * @param {CKEDITOR.dom.element} clickedSegment
   *   The clicked segment.
   *
   * @return {{indexPrevSpace: number, indexNextSpace: Number}}
   *   Return the object with the previous and next indexes.
   */
  function getClickedIndexes(range, clickedSegment) {
    var indexPrevSpace = clickedSegment.getText().lastIndexOf(' ', range.startOffset) + 1;
    var indexNextSpace = clickedSegment.getText().indexOf(' ', range.startOffset);
    if (indexPrevSpace === -1) {
      indexPrevSpace = 0;
    }
    if (indexNextSpace === -1) {
      indexNextSpace = clickedSegment.getText().length;
    }
    return {indexPrevSpace: indexPrevSpace, indexNextSpace: indexNextSpace};
  }

  /**
   * Set the data for the active editor pair.
   *
   * @param {Array|null} data
   *   Data to be put in the active EditorPair object.
   */
  function setEditorPairData(data) {
    if (data) {
      editorPairs[activeEditorId].activeSegmentId = data['segmentId'];
      editorPairs[activeEditorId].activeEditorName = CKEDITOR.currentInstance.name;
      editorPairs[activeEditorId].activeWord = data['word'];
      editorPairs[activeEditorId].activeSegmentStrippedText = data['segmentStrippedText'];
      editorPairs[activeEditorId].activeSegmentHtmlText = data['segmentHtmlText'];
      editorPairs[activeEditorId].activeTag = data['tagsStrippedText'];
      editorPairs[activeEditorId].editor = CKEDITOR.currentInstance;
    }
    else {
      editorPairs[activeEditorId].activeSegmentId = null;
      editorPairs[activeEditorId].activeWord = null;
      editorPairs[activeEditorId].activeSegmentStrippedText = null;
      editorPairs[activeEditorId].activeSegmentHtmlText = null;
      editorPairs[activeEditorId].activeTag = null;
    }
  }

  function setSameSegmentFlag(activeSegmentData) {
    if (activeSegmentData['segmentId'] === editorPairs[activeEditorId].activeSegmentId && activeSegmentData['segmentHtmlText'] === editorPairs[activeEditorId].activeSegmentHtmlText) {
      activeSegmentData['sameSegment'] = true;
    }
    else {
      activeSegmentData['sameSegment'] = false;
    }
    return activeSegmentData['sameSegment'];
  }

  /**
   * Display the selected segment and word in the area below the editor.
   */
  function appendAreaBelow() {
    // Remove the previous segment, if it exists.
    var activeSegment = document.getElementsByClassName('active-segment');
    if (activeSegment) {
      editorPairs[activeEditorId].areaBelow.innerHTML = '';
    }
    wrappers[editorPairs[activeEditorId].id].appendChild(editorPairs[activeEditorId].areaBelow);
  }

  /**
   * Create and update the counter of completed segments.
   */
  function setCounterCompletedSegments() {
    var htmldata = CKEDITOR.currentInstance.getData();
    var regex = new RegExp(constants.attribute.statusCompleted, 'g');
    var count = (htmldata.match(regex) || []).length;
    var countAll = (htmldata.match(/<\/tmgmt-segment>/g) || []).length;

    if (!document.getElementsByClassName(constants.class.segmentStatusCounter)[0]) {
      var segmentStatusCounter = count.toString() + '/' + countAll;
      appendText('tmgmt-segment-counter-div', languageFile.completedSegmentsTitle, segmentStatusCounter, document.getElementById('sidebar'), constants.class.segmentStatusCounter, false);
    }
    else {
      document.getElementsByClassName(constants.class.segmentStatusCounter)[0].innerHTML = count + '/' + countAll;
    }
  }

  /**
   * Display the specified text in the specific area.
   *
   * @param {string} parentDiv
   *   The wrapping div's class for the text.
   * @param {string} title
   *   The title.
   * @param {string|Array} text
   *   The content.
   * @param {HTMLElement} targetDiv
   *   Where we want to put our content (the area below or the sticky area).
   * @param {string} elementClassName
   *   The class for the content.
   * @param {boolean} bindEvent
   *   Flag for the onClick event binding for missing tags.
   */
  function appendText(parentDiv, title, text, targetDiv, elementClassName, bindEvent) {
    var wrapper = document.createElement('div');
    wrapper.className = parentDiv;
    var p = document.createElement('P');
    p.appendChild(document.createTextNode(title));
    wrapper.appendChild(p);
    if (elementClassName === constants.class.missingTagsCounter) {
      var missingTagsWrapper = document.createElement('div');
      missingTagsWrapper.className = constants.class.missingTagsWrapper;
      for (var j = 0; j < text.length; j++) {
        var missingTag;
        if (bindEvent) {
          missingTag = document.createElement('a');
          missingTag.className = elementClassName;
          missingTag.setAttribute('nohref', '');
          missingTag.setAttribute('title', languageFile.addMissingTagButtonTitle);
          var maskedTag = text[j].outerHTML;

          // To solve the closure issue inside the loop.
          bind_event(missingTag, maskedTag);
        }
        else {
          missingTag = document.createElement('span');
          missingTag.className = elementClassName;
        }

        missingTag.appendChild(document.createTextNode(text[j].getAttribute('element')));
        missingTagsWrapper.appendChild(missingTag);
        wrapper.appendChild(missingTagsWrapper);
      }
    }
    else {
      var span = document.createElement('span');
      span.className = elementClassName;
      span.appendChild(document.createTextNode(text));
      wrapper.appendChild(span);
    }
    targetDiv.appendChild(wrapper);

    function bind_event(a, maskedTag) {
      if (typeof window.addEventListener === 'function') {
        a.addEventListener('click', function () {
          var htmlTag = CKEDITOR.dom.element.createFromHtml(maskedTag);
          CKEDITOR.currentInstance.insertElement(htmlTag);
          CKEDITOR.currentInstance.widgets.initOn(htmlTag, 'tmgmt_tags');
        });
      }
    }
  }

  /**
   * Creates a table in the area below the editor.
   *
   * @param {object} jsonData
   *   JSON object that was returned by the query in the memory.
   */
  // @todo Source is still hardcoded.
  function createTable(jsonData) {
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var tbody = document.createElement('tbody');
    table.className = constants.class.translationSuggestions;
    var headings = [languageFile.tableTitleQuality, languageFile.tableTitleSource, languageFile.tableTitleTranslation, ''];

    var tr = document.createElement('tr');
    for (var i = 0; i < headings.length; i++) {
      var th = document.createElement('th');
      th.appendChild(document.createTextNode(headings[i]));
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    table.appendChild(thead);

    jsonData.forEach(function (object, index) {
      var tr = document.createElement('tr');
      for (var i = 0; i < headings.length; i++) {
        var td = document.createElement('td');
        if (i == 0) {
          if (jsonData[index].quality) {
            var qualityDiv = document.createElement('meter');
            var quality = jsonData[index].quality;
            qualityDiv.setAttribute('max', '10');
            qualityDiv.setAttribute('min', '0');
            qualityDiv.setAttribute('value', quality);
            td.appendChild(qualityDiv);
          }
          else {
            var noQuality = document.createTextNode('/');
            td.appendChild(noQuality);
          }
        }
        else if (i == 1) {
          td.appendChild(document.createTextNode('Human'));
        }
        else if (i == 2) {
          td.appendChild(document.createTextNode(object.trSegmentStrippedText));
        }
        else {
          var btn = document.createElement('button');
          var t = document.createTextNode('Use');
          btn.appendChild(t);
          btn.className = 'button';
          btn.setAttribute('type', 'button');
          btn.id = constants.id.buttonUseSuggestionId + index;

          btn.addEventListener('click', function () {
            addSuggestion(jsonData[index], editorPairs[activeEditorId]);
            tbody.removeChild(tr);
          });
          td.appendChild(btn);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    editorPairs[activeEditorId].areaBelow.appendChild(table);
  }

  /**
   * Add the suggestion in the translation editor.
   *
   * @param {object} jsonData
   *   JSON object that was returned by the query in the memory.
   * @param {string} selectedEditor
   *   The selected segment.
   */
  function addSuggestion(jsonData, selectedEditor) {
    var editorData = selectedEditor.editor.getData();
    var replacedText = editorData.replace(selectedEditor.activeSegmentHtmlText, jsonData.trSegmentHtmlText);

    var suggestionFallback = function () {
      var sourceSegment = selectedEditor.editor.document.getById(jsonData.sourceSegmentId);
      sourceSegment.setAttribute(constants.attribute.source, 'memory');
      sourceSegment.setAttribute(constants.attribute.quality, jsonData.quality);
    };
    CKEDITOR.currentInstance.setData(replacedText, suggestionFallback);
  }

  /**
   * Resets the active segments in the editor, so that there is only 1 active.
   */
  function resetActiveSegment() {
    var translationSegment = CKEDITOR.instances[editorPairs[activeEditorId].activeEditorName].document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    var relatedEditor = getRelatedEditor(CKEDITOR.instances[editorPairs[activeEditorId].activeEditorName]);
    var relatedSegment = relatedEditor.document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    translationSegment.removeAttribute(constants.attribute.statusActive);
    relatedSegment.removeAttribute(constants.attribute.statusActive);

    if (translationSegment.hasAttribute(constants.attribute.hasMissingTags)) {
      translationSegment.removeAttribute(constants.attribute.hasMissingTags);
      relatedSegment.removeAttribute(constants.attribute.hasMissingTags);
    }
  }

  /**
   * Marks active and completed segments in the editor.
   *
   * @param {string} status
   *   The status of the segment (active, completed or has-missing-tags).
   */
  function markSegment(status) {
    var translationSegment = CKEDITOR.currentInstance.document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    var relatedEditor = getRelatedEditor(CKEDITOR.currentInstance);
    var relatedSegment = relatedEditor.document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    if (status === 'active') {
      translationSegment.setAttribute(constants.attribute.statusActive, '');
      relatedSegment.setAttribute(constants.attribute.statusActive, '');
    }
    else if (status === 'completed') {
      translationSegment.setAttribute(constants.attribute.statusCompleted, '');
      relatedSegment.setAttribute(constants.attribute.statusCompleted, '');
    }
    else if (status === 'has-missing-tags') {
      translationSegment.setAttribute(constants.attribute.hasMissingTags, '');
      relatedSegment.setAttribute(constants.attribute.hasMissingTags, '');
    }
  }

  /**
   * Get the related editor.
   *
   * @param {CKEDITOR.editor} editor
   *   The current CKEDITOR instance.
   *
   * @return {CKEDITOR.editor} editor
   *   The related CKEDITOR instance.
   */
  function getRelatedEditor(editor) {
    var currentEditorName = editor.name;
    var relatedEditorName;
    if (CKEDITOR.instances[currentEditorName].name.match(/.*value-translation-value$/)) {
      relatedEditorName = CKEDITOR.instances[currentEditorName].name.replace('value-translation-value', 'value-source-value');
    }
    else if (CKEDITOR.instances[currentEditorName].name.match(/.*value-source-value$/)) {
      relatedEditorName = CKEDITOR.instances[currentEditorName].name.replace('value-source-value', 'value-translation-value');
    }
    return CKEDITOR.instances[relatedEditorName];
  }

})(jQuery, Drupal, Drupal.debounce, CKEDITOR);

/**
 * If we want to automatically enable the showsegments command when the editor loads.
 *
 *		config.startupOutlineBlocks = true;
 *
 * @cfg {Boolean} [startupOutlineBlocks=false]
 * @member CKEDITOR.config
 */
