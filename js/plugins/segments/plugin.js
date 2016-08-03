/**
 * @file
 * CKEditor plugin to display TMGMT segments.
 */

(function ($, Drupal, CKEDITOR) {
  'use strict';

  var tmgmtSegmentsTag = 'tmgmt-segment';
  var tmgmtTagInsideSegments = 'tmgmt-tag';
  var attrStatusCompleted = 'data-tmgmt-segment-completed-status';
  var attrStatusActive = 'data-tmgmt-segment-active-status';
  var attrSource = 'data-tmgmt-segment-source';
  var attrQuality = 'data-tmgmt-segment-quality';
  var editorTimer = null;
  var enableListener = false;
  var wrappers = [].slice.call(document.getElementsByClassName('tmgmt-ui-data-item-translation')).splice(1, 3);
  var editorPairs = [];
  var activeEditorId;

  if (window.XMLHttpRequest) {
    // code for IE7+, Firefox, Chrome, Opera, Safari
    var xmlhttp = new XMLHttpRequest();
  }

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

          // This check is because when clicking "Use suggestion", the editors
          // refresh, but the status is still active and it adds a new div.
          // editorPairs[activeEditorId].areaBelow = document.getElementsByClassName('tmgmt-segments')[editorPairs[activeEditorId].id];
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
            // Remove segmentsDiv when changing editor.
            editorPairs[activeEditorId].areaBelow.innerHTML = '';
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
    onLoad: function () {
      var cssStd, cssImgLeft, cssImgRight;

      cssStd = cssImgLeft = cssImgRight = '';

      cssStd += '.cke_show_segments ' + tmgmtSegmentsTag + '{' +
        '}';
      cssImgLeft += '.cke_show_segments ' + tmgmtSegmentsTag + '::before{' +
        'content:' + '"\u25B6"' + ';' + 'padding-right: 0.5em;' +
        '}';
      cssImgRight += '.cke_show_segments ' + tmgmtSegmentsTag + '::after{' +
        'content:' + '"\u25C0"' + ';' + 'padding-left: 0.5em;' +
        '}';

      CKEDITOR.addCss(cssStd.concat(cssImgLeft, cssImgRight));
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
          if (element.getAscendant(tmgmtSegmentsTag, true)) {
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
          element.setAttribute(attrStatusCompleted, 'completed');
          // If the clicked element is the segment, set the id.
          if (element.getName() === tmgmtSegmentsTag) {
            editorPairs[activeEditorId].activeSegmentId = element.getId();
          }
          // If the clicked element is the tag, get the id from the parent.
          else if (element.getName() === tmgmtTagInsideSegments) {
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
            wrappers[editorId].setAttribute('data-tmgmt-segments-info-area', editorId);
          }

          // Create an array of editor pairs.
          editorPairs[editorId] = new EditorPair(editorId, sourceEditor, editor, segmentsDiv, null, null, null, null, null);
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
      editor.on('change', function (evt) {
        // Exit from function when the flag is true. This is set when adding a
        // segment from the memory (clicking the button).
        if (enableListener == false) {
          return;
        }
        if (editorTimer != null && editorTimer.length) {
          clearTimeout(editorTimer);
        }
        editorTimer = setTimeout(function () {
          refreshActiveContent();
          // Check for tag validation.
          EditorPair.prototype.tagValidation();
        }, 1000);
      });

      function onFocusBlur() {
        command.refresh(editor);
      }
    }
  });

  // New structure per editor pair.
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

  // Get the difference in the number of tags.
  EditorPair.prototype.tagValidation = function () {
    var segmentsLeft = editorPairs[activeEditorId].leftEditor.document.$.getElementsByTagName(tmgmtSegmentsTag);
    var segmentsRight = editorPairs[activeEditorId].rightEditor.document.$.getElementsByTagName(tmgmtSegmentsTag);
    var numberOfTagsPerSegmentLeft;
    var numberOfTagsPerSegmentRight;
    var arrayOfTagsPerSegmentLeft = [];
    var arrayOfTagsPerSegmentRight = [];
    var differences = [];
    var differentTags = [];
    var globalCounter = 0;
    var segmentsWithMissingTags = [];
    // var segmentsId;

    if (segmentsLeft.length === segmentsRight.length) {
      for (var i = 0; i < segmentsLeft.length; i++) {
        numberOfTagsPerSegmentLeft = segmentsLeft[i].getElementsByTagName(tmgmtTagInsideSegments).length;
        numberOfTagsPerSegmentRight = segmentsRight[i].getElementsByTagName(tmgmtTagInsideSegments).length;

        if (numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight !== 0) {
          var validationWrapper = document.createElement('div');
          validationWrapper.className = 'tmgmt-segment-validation-div messages messages--error';

          segmentsWithMissingTags.push(segmentsLeft[i].id);

          if (!editorPairs[activeEditorId].activeSegmentId || !_.contains(segmentsWithMissingTags, editorPairs[activeEditorId].activeSegmentId)) {
/*            if (document.getElementsByClassName('tmgmt-segment-validation-counter-div')[0]) {
             document.getElementsByClassName('tmgmt-segment-validation-counter-div')[0].remove();
             document.getElementsByClassName('tmgmt-segment-validation-tags-div')[0].remove();
             }
             if (document.getElementsByClassName('tmgmt-segment-validation-global-counter-div')[0]) {
             document.getElementsByClassName('tmgmt-segment-validation-global-counter-div')[0].remove();
             }*/

            globalCounter += numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight;
            if (!document.getElementsByClassName('tmgmt-segment-validation-global-counter-div')[0]) {
              createNewParagraph('tmgmt-segment-validation-global-counter-div', 'Number of all missing tags is', globalCounter, editorPairs[activeEditorId].areaBelow, 'segment-validation-missing-tags-global-counter');
            }
            else {
              document.getElementsByClassName('segment-validation-missing-tags-global-counter')[0].innerHTML = globalCounter;
            }

            validationWrapper.appendChild(document.getElementsByClassName('tmgmt-segment-validation-global-counter-div')[0]);
          }
          else {
            if (editorPairs[activeEditorId].activeSegmentId === segmentsLeft[i].id) {
              arrayOfTagsPerSegmentLeft = segmentsLeft[i].getElementsByTagName(tmgmtTagInsideSegments);
              arrayOfTagsPerSegmentRight = segmentsLeft[i].getElementsByTagName(tmgmtTagInsideSegments);

              differences = _.difference(arrayOfTagsPerSegmentLeft, arrayOfTagsPerSegmentRight);
              for (var j = 0; j < differences.length; j++) {
                differentTags.push(differences[j].getAttribute('element'));
              }
              // Do we want to display the segments id here or the index?
              // segmentsId = segmentsLeft[i].id;
              createNewParagraph('tmgmt-segment-validation-counter-div', 'Number of missing tags for the ' + [i + 1] + '. ' + 'segment is', numberOfTagsPerSegmentLeft - numberOfTagsPerSegmentRight, editorPairs[activeEditorId].areaBelow, 'segment-validation-missing-tags-counter');
              if (differences.length === 1) {
                createNewParagraph('tmgmt-segment-validation-tags-div', 'The missing tag for the ' + [i + 1] + '. ' + 'segment is', differentTags.toString(), editorPairs[activeEditorId].areaBelow, 'segment-validation-missing-tags');
              }
              else {
                createNewParagraph('tmgmt-segment-validation-tags-div', 'The missing tags for the ' + [i + 1] + '. ' + 'segment are', differentTags.toString(), editorPairs[activeEditorId].areaBelow, 'segment-validation-missing-tags');
              }

/*              if (document.getElementsByClassName('tmgmt-segment-validation-global-counter-div')[0]) {
                document.getElementsByClassName('tmgmt-segment-validation-global-counter-div')[0].remove();
              }*/

              validationWrapper.appendChild(document.getElementsByClassName('tmgmt-segment-validation-counter-div')[0]);
              validationWrapper.appendChild(document.getElementsByClassName('tmgmt-segment-validation-tags-div')[0]);
            }
          }
          editorPairs[activeEditorId].areaBelow.appendChild(validationWrapper);
        }
      }
    }
  };

  // Things to do after the content is selected.
  function refreshActiveContent() {
    // We only display the clicked texts when the plugin is enabled/clicked -
    // the area below exists (depends on the state).
    if (editorPairs[activeEditorId].activeSegmentId && editorPairs[activeEditorId].activeEditorName) {
      resetActiveSegment();
    }

    var selectedContent = getActiveContent();
    // If the segment is clicked, display it.
    if (selectedContent) {
      // Display the segment as active.
      displayContent();

      // Do the http request to the memory.
      getDataFromMemory(selectedContent);
    }
    // If something else is clicked, remove the previous displayed segment.
    else {
      editorPairs[activeEditorId].areaBelow.innerHTML = '';
    }
  }

  function getDataFromMemory(selectedContent) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        var jsonData = JSON.parse(xmlhttp.responseText);
        // Make a wrapper for suggested translations.
        var suggestedTranslations = document.createElement('div');
        suggestedTranslations.className = 'suggested-translations';
        editorPairs[activeEditorId].areaBelow.appendChild(suggestedTranslations);

        var p1 = document.createElement('P');
        p1.className = 'tmgmt-active-segment-wrapper';
        p1.appendChild(document.createTextNode('Translations of '));
        var span = document.createElement('span');
        span.className = 'tmgmt-active-segment';
        span.appendChild(document.createTextNode('"' + editorPairs[activeEditorId].activeSegmentStrippedText + '"'));
        p1.appendChild(span);
        suggestedTranslations.appendChild(p1);

        createTable(jsonData);
      }
    };
    xmlhttp.open('GET', drupalSettings.path.baseUrl +
      'tmgmt_ckeditor/get.json?segmentStrippedText=' + selectedContent['segmentStrippedText'] +
      '&segmentHtmlText=' + encodeURIComponent(selectedContent['segmentHtmlText']) +
      '&lang_source=' + selectedContent['sourceLanguage'] +
      '&lang_target=' + selectedContent['targetLanguage'], true);
    xmlhttp.send();
  }

  // Gets the selected segment and word.
  function getActiveContent() {
    var range = CKEDITOR.currentInstance.getSelection().getRanges()[0];
    var clickedSegment = range.startContainer.getParent();

    // If we clicked the segment or the tag inside.
    if (range.startOffset && (clickedSegment.getName() === tmgmtSegmentsTag || clickedSegment.getParent().getName() === tmgmtSegmentsTag)) {
      var indexPrevSpace = clickedSegment.getText().lastIndexOf(' ', range.startOffset) + 1;
      var indexNextSpace = clickedSegment.getText().indexOf(' ', range.startOffset);
      if (indexPrevSpace === -1) {
        indexPrevSpace = 0;
      }
      if (indexNextSpace === -1) {
        indexNextSpace = clickedSegment.getText().length;
      }

      // If the clicked element was the tag, we need to get the parent
      var activeSegmentData = [];
      if (clickedSegment.getName() === tmgmtTagInsideSegments) {
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

      activeSegmentData['word'] = clickedSegment.getText().substring(indexPrevSpace, indexNextSpace).replace(/[.,:;!?]$/,'');
      activeSegmentData['sourceLanguage'] = drupalSettings.sourceLanguage;
      activeSegmentData['targetLanguage'] = drupalSettings.targetLanguage;

      editorPairs[activeEditorId].activeSegmentId = activeSegmentData['segmentId'];
      editorPairs[activeEditorId].activeEditorName = CKEDITOR.currentInstance.name;
      editorPairs[activeEditorId].activeWord = activeSegmentData['word'];
      editorPairs[activeEditorId].activeSegmentStrippedText = activeSegmentData['segmentStrippedText'];
      editorPairs[activeEditorId].activeSegmentHtmlText = activeSegmentData['segmentHtmlText'];
      editorPairs[activeEditorId].activeTag = activeSegmentData['tagsStrippedText'];
      markSegment('active');

      // Return the word without extra characters.
      return activeSegmentData;
    }
    // If we clicked outside of the segment, we reset the active segments and tags.
    editorPairs[activeEditorId].activeSegmentId = null;
    editorPairs[activeEditorId].activeWord = null;
    editorPairs[activeEditorId].activeSegmentStrippedText = null;
    editorPairs[activeEditorId].activeSegmentHtmlText = null;
    editorPairs[activeEditorId].activeTag = null;
    return null;
  }

  // Displays the selected segment and word in the area below the editor.
  function displayContent() {
    // Remove the previous segment, if it exists.
    var activeSegment = document.getElementsByClassName('active-segment-text');
    if (activeSegment) {
      editorPairs[activeEditorId].areaBelow.innerHTML = '';
    }

    EditorPair.prototype.tagValidation();
    // createNewParagraph('tmgmt-active-segment-div', 'Selected segment', editorPairs[activeEditorId].activeSegmentStrippedText, editorPairs[activeEditorId].areaBelow, 'active-segment');
    // createNewParagraph('tmgmt-active-word-div', 'Selected word', editorPairs[activeEditorId].activeWord, editorPairs[activeEditorId].areaBelow, 'active-word');
    //if (editorPairs[activeEditorId].activeTag) {
    //  createNewParagraph('tmgmt-active-tag-div', 'Selected tag', editorPairs[activeEditorId].activeTag, editorPairs[activeEditorId].areaBelow, 'active-tag');
    //}

    wrappers[editorPairs[activeEditorId].id].appendChild(editorPairs[activeEditorId].areaBelow);
  }

  // Helper function to create and update the counter of completed segments.
  function setCounterCompletedSegments() {
    var htmldata = CKEDITOR.currentInstance.getData();
    var regex = new RegExp(attrStatusCompleted, 'g');
    var count = (htmldata.match(regex) || []).length;
    var countAll = (htmldata.match(/<\/tmgmt-segment>/g) || []).length;

    if (!document.getElementsByClassName('segment-status-counter')[0]) {
      var segmentStatusCounter = count.toString() + '/' + countAll;
      createNewParagraph('tmgmt-segment-counter-div','Completed segments', segmentStatusCounter, document.getElementById('sidebar'), 'segment-status-counter');
    }
    else {
      document.getElementsByClassName('segment-status-counter')[0].innerHTML = count + '/' + countAll;
    }
  }

  // Helper function for creating new paragraph in the area below.
  function createNewParagraph(parentDiv, title, text, targetDiv, paragraphClassName) {
    var wrapper = document.createElement('div');
    wrapper.className = parentDiv;
    var p = document.createElement('P');
    p.appendChild(document.createTextNode(title + ':'));
    wrapper.appendChild(p);
    var span = document.createElement('span');
    span.className = paragraphClassName;
    span.appendChild(document.createTextNode(text));
    wrapper.appendChild(span);
    targetDiv.appendChild(wrapper);
  }

  // Creates a table in the area below the editor.
  // @todo We have lots of hardcoded stuff for now. Needs work and discussion.
  function createTable(jsonData) {
    var table = document.createElement('table');
    table.className = 'tmgmt-translation-suggestions';
    var headings = ['Quality', 'Source', 'Translation', 'Use suggestion'];

    var tr = document.createElement('tr');
    for (var i = 0; i < headings.length; i++) {
      var th = document.createElement('th');
      th.appendChild(document.createTextNode(headings[i]));
      tr.appendChild(th);
    }
    table.appendChild(tr);

    jsonData.forEach(function (object, index) {
      var tr = document.createElement('tr');
      for (var i = 0; i < headings.length; i++) {
        var td = document.createElement('td');
        if (i == 0) {
          // For the purpose of the mockup!
          // @todo remove these checks and use real values from the memory
          var qualityDiv = document.createElement('meter');
          if (index == 0) {
            qualityDiv.setAttribute('max', '1.0');
            qualityDiv.setAttribute('min', '0.0');
            qualityDiv.setAttribute('value', '1.0');
            td.appendChild(qualityDiv);
          }
          else if (index == 1) {
            qualityDiv.setAttribute('max', '1.0');
            qualityDiv.setAttribute('min', '0.0');
            qualityDiv.setAttribute('value', '0.5');
            td.appendChild(qualityDiv);
          }
          else if (index == 2) {
            qualityDiv.setAttribute('max', '1.0');
            qualityDiv.setAttribute('min', '0.0');
            qualityDiv.setAttribute('value', '0.1');
            td.appendChild(qualityDiv);
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
          var t = document.createTextNode('Use suggestion');
          btn.appendChild(t);
          btn.className = 'button';
          btn.setAttribute('type', 'button');
          btn.id = 'btn-use-suggestion-' + index;

          btn.addEventListener('click', function (evt) {
            addSuggestion(jsonData[index], editorPairs[activeEditorId].activeSegmentHtmlText);
            table.removeChild(tr);
          });
          td.appendChild(btn);
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    });
    editorPairs[activeEditorId].areaBelow.appendChild(table);
  }

  // Adds the suggestion in the translation editor.
  function addSuggestion(jsonData, selectedSegment) {
    var editor = CKEDITOR.currentInstance;
    var editorData = editor.getData();
    var replaced_text = editorData.replace(selectedSegment, jsonData.trSegmentHtmlText);

    var suggestionFallback = function () {
      var sourceSegment = editor.document.getById(jsonData.sourceSegmentId);
      sourceSegment.setAttribute(attrSource, 'memory');
      sourceSegment.setAttribute(attrQuality, jsonData.quality);
    };
    editor.setData(replaced_text, suggestionFallback);
  }

  // Resets the active segments in the editor, so that there is only 1 active.
  // @todo No iteration, hardcode the editors for now or make them work in pairs.
  function resetActiveSegment() {
    var translationSegment = CKEDITOR.instances[editorPairs[activeEditorId].activeEditorName].document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    var relatedEditor = getRelatedEditor(CKEDITOR.instances[editorPairs[activeEditorId].activeEditorName]);
    var relatedSegment = relatedEditor.document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    translationSegment.removeAttribute(attrStatusActive);
    relatedSegment.removeAttribute(attrStatusActive);
  }

  // Marks active and completed segments in the editor.
  // @todo This marker should be added only when editing.
  function markSegment(status) {
    var translationSegment = CKEDITOR.currentInstance.document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    var relatedEditor = getRelatedEditor(CKEDITOR.currentInstance);
    var relatedSegment = relatedEditor.document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    if (status === 'active') {
      translationSegment.setAttribute(attrStatusActive, '');
      relatedSegment.setAttribute(attrStatusActive, '');
    }
    else if (status === 'completed') {
      translationSegment.setAttribute(attrStatusCompleted, '');
      relatedSegment.setAttribute(attrStatusCompleted, '');
    }
  }

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

})(jQuery, Drupal, CKEDITOR);

/**
 * If we want to automatically enable the showsegments command when the editor loads.
 *
 *		config.startupOutlineBlocks = true;
 *
 * @cfg {Boolean} [startupOutlineBlocks=false]
 * @member CKEDITOR.config
 */
