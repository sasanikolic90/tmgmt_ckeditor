﻿/**
 * @file
 * CKEditor plugin to display TMGMT segments.
 */

(function ($, Drupal, debounce, CKEDITOR) {
  'use strict';

  // Create object with constants
  var constants = {
    tmgmtSegmentsTag: 'tmgmt-segment',
    tmgmtTagInsideSegments: 'tmgmt-tag',
    attrStatusCompleted: 'data-tmgmt-segment-completed-status',
    attrStatusActive: 'data-tmgmt-segment-active-status',
    attrSource: 'data-tmgmt-segment-source',
    attrQuality: 'data-tmgmt-segment-quality',
    attrHasMissingTags: 'data-tmgmt-segment-missing-tags'
  };

  var enableListener = false;
  var editorPairs = [];
  var wrappers = [].slice.call(document.getElementsByClassName('tmgmt-ui-data-item-translation')).splice(1, 3);
  var activeEditorId;

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
                label: 'Set status completed',
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
      var cssStd, cssImgLeft, cssImgRight;

      cssStd = cssImgLeft = cssImgRight = '';

      cssStd += '.cke_show_segments ' + constants.tmgmtSegmentsTag + '{' +
        '}';
      cssImgLeft += '.cke_show_segments ' + constants.tmgmtSegmentsTag + '::before{' +
        'content:' + '"\u25B6"' + ';' + 'padding-right: 0.5em;' +
        '}';
      cssImgRight += '.cke_show_segments ' + constants.tmgmtSegmentsTag + '::after{' +
        'content:' + '"\u25C0"' + ';' + 'padding-left: 0.5em;' +
        '}';

      CKEDITOR.addCss(cssStd.concat(cssImgLeft, cssImgRight));
    },

    beforeInit: function (editor) {
      var dtd = CKEDITOR.dtd;
      dtd.$block['tmgmt-segment'] = 1;  // Make the segments blocks.
      dtd.body['tmgmt-segment'] = 1;  // Body may contain tmgmt-segment.
      dtd['tmgmt-segment'] = CKEDITOR.dtd['div'];  // tmgmt-segment should behaves as a div.
      dtd['tmgmt-segment']['tmgmt-tag'] = 1;
      dtd.$editable['tmgmt-segment'] = 1;
/*      dtd['tmgmt-segment'] = {'#': 1};
      dtd['tmgmt-tag'] = {'#': 1};*/

      dtd['tmgmt-tag'] = {};
      dtd.$object['tmgmt-tag'] = 1;
      dtd.$empty['tmgmt-tag'] = 1;
      dtd.$inline['tmgmt-tag'] = 1;
      // editor.filter.allow('tmgmt-segment[id,data-tmgmt-segment-completed-status,data-tmgmt-segment-active-status,data-tmgmt-segment-source,data-tmgmt-segment-quality] tmgmt-tag[!element,!raw]');

      editor.widgets.add('tmgmt_tags', {
        // Minimum HTML which is required by this widget to work.
        // allowedContent: '',
        inline: true,
        allowedContent: 'tmgmt-tag[element,raw]',
        requiredContent: 'tmgmt-tag[element,raw]',

        editables: {
          content: {
            selector: 'tmgmt-tag'
          }
        },

        upcast: function (element) {
          return element.name === 'tmgmt-tag';
        }
      });
    },

    init: function (editor) {
      if (editor.blockless) {
        return;
      }

      // Load the plugin only on translate/review pages.
      // This is a really bad solution! CHANGE THIS!
      if (document.getElementsByClassName('tmgmt-ui-review').length === 0) {
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
          if (element.getAscendant(constants.tmgmtSegmentsTag, true)) {
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
          element.setAttribute(constants.attrStatusCompleted, 'completed');
          // If the clicked element is the segment, set the id.
          if (element.getName() === constants.tmgmtSegmentsTag) {
            editorPairs[activeEditorId].activeSegmentId = element.getId();
          }
          // If the clicked element is the tag, get the id from the parent.
          else if (element.getName() === constants.tmgmtTagInsideSegments) {
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
          // remove the second class with the id
          segmentsDiv.className = 'tmgmt-segments segment-pair-' + editorId;
          wrappers[editorId].appendChild(segmentsDiv);
          if (!editor.getData()) {
            editor.setData(sourceEditor.getData());
            wrappers[editorId].setAttribute('data-tmgmt-segments-info-area', editorId);
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
   * @constructor
   */
  function EditorPair(id, leftEditor, rightEditor, areaBelow, activeEditorName, activeSegmentId, activeWord, activeTag, counter) {
    this.id = id;
    this.leftEditor = leftEditor;
    this.rightEditor = rightEditor;
    this.areaBelow = areaBelow;
    this.activeEditorName = activeEditorName;
    this.activeSegmentId = activeSegmentId;
    this.activeWord = activeWord;
    this.activeTag = activeTag;
    this.completedCounter = counter;
  }

/*  function AreaBelow(segmentsDiv) {
    this.div = segmentsDiv;
  }*/

  /**
   * Get the difference in the number of tags for a selected segment.
   */
  EditorPair.prototype.tagValidation = function () {
    var segmentsLeft = editorPairs[activeEditorId].leftEditor.document.$.getElementsByTagName(constants.tmgmtSegmentsTag);
    var segmentsRight = editorPairs[activeEditorId].rightEditor.document.$.getElementsByTagName(constants.tmgmtSegmentsTag);
    var numberOfTagsPerSegmentLeft;
    var numberOfTagsPerSegmentRight;
    var arrayOfTagsPerSegmentLeft = [];
    var arrayOfTagsPerSegmentRight = [];
    var differences = [];
    var globalCounter = 0;
    var segmentsWithMissingTags = [];
    var validationWrapper = document.createElement('div');
    validationWrapper.className = 'tmgmt-segment-validation-div messages messages--error';

    if (segmentsLeft.length === segmentsRight.length) {
      for (var i = 0; i < segmentsLeft.length; i++) {
        numberOfTagsPerSegmentLeft = segmentsLeft[i].getElementsByTagName(constants.tmgmtTagInsideSegments).length;
        numberOfTagsPerSegmentRight = segmentsRight[i].getElementsByTagName(constants.tmgmtTagInsideSegments).length;

        if (numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight !== 0) {

          segmentsWithMissingTags.push(segmentsLeft[i].id);

          if (!editorPairs[activeEditorId].activeSegmentId || !_.contains(segmentsWithMissingTags, editorPairs[activeEditorId].activeSegmentId)) {
            globalCounter += numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight;
            if (!document.getElementsByClassName('tmgmt-segment-validation-global-counter-div')[0]) {
              appendText('tmgmt-segment-validation-global-counter-div', 'Number of all missing tags is', globalCounter, editorPairs[activeEditorId].areaBelow, 'segment-validation-missing-tags-global-counter');
            }
            else {
              document.getElementsByClassName('segment-validation-missing-tags-global-counter')[0].innerHTML = globalCounter;
            }

            validationWrapper.appendChild(document.getElementsByClassName('tmgmt-segment-validation-global-counter-div')[0]);
          }
          else {
            if (editorPairs[activeEditorId].activeSegmentId === segmentsLeft[i].id) {
              markSegment('has-missing-tags');
              arrayOfTagsPerSegmentLeft = segmentsLeft[i].getElementsByTagName(constants.tmgmtTagInsideSegments);
              arrayOfTagsPerSegmentRight = segmentsRight[i].getElementsByTagName(constants.tmgmtTagInsideSegments);

              differences = getDifferences(arrayOfTagsPerSegmentLeft, arrayOfTagsPerSegmentRight);

              if (differences.length === 1) {
                appendText('tmgmt-segment-validation-tags-div', numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight + ' missing tag for the selected segment:', differences , editorPairs[activeEditorId].areaBelow, 'segment-validation-missing-tags');
              }
              else {
                appendText('tmgmt-segment-validation-tags-div', numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight + ' missing tags for the selected segment:', differences , editorPairs[activeEditorId].areaBelow, 'segment-validation-missing-tags');
              }
              validationWrapper.appendChild(document.getElementsByClassName('tmgmt-segment-validation-tags-div')[0]);
            }
          }
          editorPairs[activeEditorId].areaBelow.appendChild(validationWrapper);
        }
      }
    }
    else {
      appendText('tmgmt-segment-validation-segments-mismatch-div', 'The number of segments in both editors does not match.', '', editorPairs[activeEditorId].areaBelow, 'segment-validation-segments-mismatch');
      validationWrapper.appendChild(document.getElementsByClassName('tmgmt-segment-validation-segments-mismatch-div')[0]);
    }
  };

  /**
   * Get the difference between the active segment in both editors.
   *
   * @param {Array} array1
   *   Array of tags in the left editor's active segment.
   * @param {Array} array2
   *   Array of tags in the left editor's active segment.
   * @return {Array}
   *   Array of different tags.
   */
  function getDifferences(array1, array2) {
    var diff = [];
    if (array2.length === 0) {
      diff = array1;
    }
    else {
      for (var i = 0; i < array1.length; i++) {
        for (var j = 0; j < array2.length; j++) {
          if (!array1[i].isEqualNode(array2[j])) {
            diff.push(array1[i]);
          }
        }
      }
    }
    return diff;
  }

  /**
   * Refresh the active content after the segment is selected.
   */
  function refreshActiveContent() {
    // We only display the clicked texts when the plugin is enabled/clicked -
    // the area below exists (depends on the state).
    if (editorPairs[activeEditorId].activeSegmentId && editorPairs[activeEditorId].activeEditorName) {
      resetActiveSegment();
    }

    var selectedContent = getActiveContent();
    // If the segment is clicked, display it.
    if (selectedContent && selectedContent['sameSegment'] !== true) {
      // Append the area below the current editor.
      appendAreaBelow();

      // Do the http request to the memory.
      getDataFromMemory(selectedContent);
    }
    // If something else is clicked, remove the previous displayed segment.
    // do this in appendAreaBelow()?
    else if (selectedContent === null) {
      editorPairs[activeEditorId].areaBelow.innerHTML = '';
    }

    // Check for tag validation.
    EditorPair.prototype.tagValidation();
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
        noSuggestionsWrapper.className = 'no-suggested-translations-wrapper';
        editorPairs[activeEditorId].areaBelow.appendChild(noSuggestionsWrapper);

        var text = document.createElement('P');
        text.className = 'no-suggested-translations';
        text.appendChild(document.createTextNode('There are no translations for this segment in the translation memory.'));
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
    suggestedTranslations.className = 'suggested-translations';
    editorPairs[activeEditorId].areaBelow.appendChild(suggestedTranslations);

    var p1 = document.createElement('P');
    p1.className = 'tmgmt-active-segment-wrapper';
    p1.appendChild(document.createTextNode(CKEDITOR.currentInstance.lang.tmgmt_segments.suggestedTranslationsTitle));
    var span = document.createElement('span');
    span.className = 'tmgmt-active-segment';
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
    if (range.startOffset && (clickedSegment.getName() === constants.tmgmtSegmentsTag || clickedSegment.getParent().getName() === constants.tmgmtSegmentsTag)) {

      var indexes = getClickedIndexes(range, clickedSegment);

      // If the clicked element was the tag, we need to get the parent.
      var activeSegmentData = [];
      if (clickedSegment.getName() === constants.tmgmtTagInsideSegments) {
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

      // Set flag if the user clicked the same segment again.
      setSameSegmentFlag(activeSegmentData);

      var editorData = CKEDITOR.currentInstance.getData();
      var clickedSegmentId = activeSegmentData['segmentId'];
      var regexForSegmentHtmlText = new RegExp('<tmgmt-segment.*? id=\"' + clickedSegmentId + '\">(.*?)<\/tmgmt-segment>');
      // regexForSegmentHtmlText.lastIndex = 0; // Reset the last index of regex (null issue).
      activeSegmentData['segmentHtmlText'] = regexForSegmentHtmlText.exec(editorData)[1];

      activeSegmentData['word'] = clickedSegment.getText().substring(indexes.indexPrevSpace, indexes.indexNextSpace).replace(/[.,:;!?]$/,'');
      activeSegmentData['sourceLanguage'] = drupalSettings.sourceLanguage;
      activeSegmentData['targetLanguage'] = drupalSettings.targetLanguage;

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
    if (activeSegmentData['segmentId'] === editorPairs[activeEditorId].activeSegmentId) {
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
    var activeSegment = document.getElementsByClassName('active-segment-text');
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
    var regex = new RegExp(constants.attrStatusCompleted, 'g');
    var count = (htmldata.match(regex) || []).length;
    var countAll = (htmldata.match(/<\/tmgmt-segment>/g) || []).length;

    if (!document.getElementsByClassName('segment-status-counter')[0]) {
      var segmentStatusCounter = count.toString() + '/' + countAll;
      appendText('tmgmt-segment-counter-div','Completed segments:', segmentStatusCounter, document.getElementById('sidebar'), 'segment-status-counter');
    }
    else {
      document.getElementsByClassName('segment-status-counter')[0].innerHTML = count + '/' + countAll;
    }
  }

  /**
   * Display the specified text in the specific area.
   *
   * @param {string} parentDiv
   *   The wrapping div's class for the text.
   * @param {string} title
   *   The title.
   * @param {string} text
   *   The content.
   * @param {string} targetDiv
   *   Where we want to put our content (the area below or the sticky area).
   * @param {string} elementClassName
   *   The class for the content.
   */
  function appendText(parentDiv, title, text, targetDiv, elementClassName) {
    var wrapper = document.createElement('div');
    wrapper.className = parentDiv;
    var p = document.createElement('P');
    p.appendChild(document.createTextNode(title));
    wrapper.appendChild(p);
    if (elementClassName === 'segment-validation-missing-tags') {
      var missingTagsWrapper = document.createElement('div');
      missingTagsWrapper.className = 'tmgmt-missing-tags-wrapper';
      for (var j = 0; j < text.length; j++) {
        var a = document.createElement('a');
        a.className = elementClassName;
        a.setAttribute('nohref', '');
        a.setAttribute('title', 'Click to add this missing tag on cursor position.');
        var maskedTag = text[j].outerHTML;

        // To solve the closure issue inside the loop.
        bind_event(a, maskedTag);

        a.appendChild(document.createTextNode(text[j].getAttribute('element')));
        missingTagsWrapper.appendChild(a);
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
    table.className = 'tmgmt-translation-suggestions';
    var headings = ['Quality', 'Source', 'Translation', ''];

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
            qualityDiv.setAttribute('max', '5');
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
          btn.id = 'btn-use-suggestion-' + index;

          btn.addEventListener('click', function (evt) {
            addSuggestion(jsonData[index], editorPairs[activeEditorId].activeSegmentHtmlText);
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
   * @param {string} selectedSegment
   *   The selected segment.
   */
  function addSuggestion(jsonData, selectedSegment) {
    var editor = CKEDITOR.currentInstance;
    var editorData = editor.getData();
    var replacedText = editorData.replace(selectedSegment, jsonData.trSegmentHtmlText);

    var suggestionFallback = function () {
      var sourceSegment = editor.document.getById(jsonData.sourceSegmentId);
      sourceSegment.setAttribute(constants.attrSource, 'memory');
      sourceSegment.setAttribute(constants.attrQuality, jsonData.quality);
    };
    editor.setData(replacedText, suggestionFallback);
  }

  /**
   * Resets the active segments in the editor, so that there is only 1 active.
   */
  function resetActiveSegment() {
    var translationSegment = CKEDITOR.instances[editorPairs[activeEditorId].activeEditorName].document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    var relatedEditor = getRelatedEditor(CKEDITOR.instances[editorPairs[activeEditorId].activeEditorName]);
    var relatedSegment = relatedEditor.document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    translationSegment.removeAttribute(constants.attrStatusActive);
    relatedSegment.removeAttribute(constants.attrStatusActive);

    if (translationSegment.hasAttribute(constants.attrHasMissingTags)) {
      translationSegment.removeAttribute(constants.attrHasMissingTags);
      relatedSegment.removeAttribute(constants.attrHasMissingTags);
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
      translationSegment.setAttribute(constants.attrStatusActive, '');
      relatedSegment.setAttribute(constants.attrStatusActive, '');
    }
    else if (status === 'completed') {
      translationSegment.setAttribute(constants.attrStatusCompleted, '');
      relatedSegment.setAttribute(constants.attrStatusCompleted, '');
    }
    else if (status === 'has-missing-tags') {
      translationSegment.setAttribute(constants.attrHasMissingTags, '');
      relatedSegment.setAttribute(constants.attrHasMissingTags, '');
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
