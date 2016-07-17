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
      var relatedEditor = EditorPair.prototype.getRelatedEditor(editor);
      relatedEditor.commands.showsegments.toggleState();
    },

    refresh: function (editor) {
      if (editor.document) {
        // showSegments turns inactive after editor loses focus when in inline.
        var showSegments = (this.state === CKEDITOR.TRISTATE_ON &&
        (editor.elementMode !== CKEDITOR.ELEMENT_MODE_INLINE || editor.focusManager.hasFocus));

        var matchId = editor.name.match(/\d+/);
        activeEditorId = parseInt(matchId[0], 10);
        editorPairs[activeEditorId].activeEditorName = editor.name;
        var relatedEditor = EditorPair.prototype.getRelatedEditor(editor);

        var funcName = showSegments ? 'attachClass' : 'removeClass';
        editor.editable()[funcName]('cke_show_segments');

        // Display segments also in the related editor.
        relatedEditor.editable()[funcName]('cke_show_segments');

        // Display the segments' content below the translate editor if the
        // plugin is enabled.
        if (this.state === 1) {
          // Set the active editor,
          editorPairs[activeEditorId].activeEditor = editor;
          // Set the active editor name.
          editorPairs[activeEditorId].activeEditorName = editor.name;

          // Set the flag for the keystrokes listeners to enabled.
          enableListener = true;

          // This check is because when clicking "Use suggestion", the editors
          // refresh, but the status is still active and it adds a new div.
          editorPairs[activeEditorId].areaBelow = document.getElementsByClassName('tmgmt-segments')[editorPairs[activeEditorId].id];
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
          editable.attachListener(editable, 'click', function (event) {
            event.preventDefault();
            // Remove segmentsDiv when changing editor.
            editorPairs[activeEditorId].areaBelow.innerHTML = '';
            // Set the editorPairs[activeEditorId].id to the newly clicked editor's id.
            refreshActiveContent();
          });
        }
        // Remove the segments display area below the editor when we disable
        // the plugin.
        else {
          editorPairs[activeEditorId].areaBelow.innerHTML = '';
          // Remove the context menu item.
          editor.removeMenuItem('setStatusItem');
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
          EditorPair.prototype.markSegment('completed');

          EditorPair.prototype.setCounterCompletedSegments();
        }
      });

      editor.on('instanceReady', function () {
        var segmentsDiv;
        var translationNameMatch = editor.name.match(/.*value-translation-value$/);
        // Get the editor id.
        var editorMatchId = editor.name.match(/\d+/);
        var editorId = parseInt(editorMatchId[0], 10);

        // When the data is loaded and the translation editor is empty, populate
        // the content with the corresponding source content.
        if (translationNameMatch != null && !editor.getData()) {
          var sourceEditor = EditorPair.prototype.getRelatedEditor(editor);
          editor.setData(sourceEditor.getData());

          wrappers[editorId].setAttribute('data-tmgmt-segments-info-area', editorId);
          segmentsDiv = document.createElement('div');
          segmentsDiv.className = 'tmgmt-segments';
          wrappers[editorId].appendChild(segmentsDiv);

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

      /*// Refresh the editor when the plugin is enabled.
      editor.on('mode', function () {
        if (command.state !== CKEDITOR.TRISTATE_DISABLED) {
          command.refresh(editor);
        }
      });*/

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
        }, 1000);
      });

      function onFocusBlur() {
        command.refresh(editor);
      }
    }
  });

  // New structure per editor pair.
  function EditorPair(id, leftEditor, rightEditor, areaBelow, activeEditor, activeEditorName, activeSegmentId, activeWord, counter) {
    this.id = id;
    this.leftEditor = leftEditor;
    this.rightEditor = rightEditor;
    this.areaBelow = areaBelow;
    this.activeEditor = activeEditor;
    this.activeEditorName = activeEditorName;
    this.activeSegmentId = activeSegmentId;
    this.activeWord = activeWord;
    this.completedCounter = counter;
  }

  EditorPair.prototype.getRelatedEditor = function (editor) {
    var currentEditorName = editor.name;
    var relatedEditorName;
    if (CKEDITOR.instances[currentEditorName].name.match(/.*value-translation-value$/)) {
      relatedEditorName = CKEDITOR.instances[currentEditorName].name.replace('value-translation-value', 'value-source-value');
    }
    else if (CKEDITOR.instances[currentEditorName].name.match(/.*value-source-value$/)) {
      relatedEditorName = CKEDITOR.instances[currentEditorName].name.replace('value-source-value', 'value-translation-value');
    }
    return CKEDITOR.instances[relatedEditorName];
  };

  function getDataFromMemory(selectedContent) {
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        var jsonData = JSON.parse(xmlhttp.responseText);
        // Make a wrapper for suggested translations.
        var suggestedTranslations = document.createElement('div');
        suggestedTranslations.className = 'suggested-translations';
        editorPairs[activeEditorId].areaBelow.appendChild(suggestedTranslations);

        jsonData.forEach(function (object, index) {
          EditorPair.prototype.suggestTranslation(object, index, selectedContent['segmentHtmlText'], suggestedTranslations);
        });
      }
    };
    xmlhttp.open('GET', drupalSettings.path.baseUrl +
      'tmgmt_ckeditor/get.json?segmentStrippedText=' + selectedContent['segmentStrippedText'] +
      '&segmentHtmlText=' + selectedContent['segmentHtmlText'] +
      '&lang_source=' + selectedContent['sourceLanguage'] +
      '&lang_target=' + selectedContent['targetLanguage'], true);
    xmlhttp.send();
  }

  // Gets the selected segment and word.
  EditorPair.prototype.getActiveContent = function () {
    var range = editorPairs[activeEditorId].activeEditor.getSelection().getRanges()[0];
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
        activeSegmentData['segmentHtmlText'] = clickedSegment.getParent().getHtml();
      }
      else {
        activeSegmentData['segmentId'] = clickedSegment.getAttribute('id');
        activeSegmentData['segmentStrippedText'] = clickedSegment.getText();
        activeSegmentData['segmentHtmlText'] = clickedSegment.getHtml();
      }
      activeSegmentData['word'] = clickedSegment.getText().substring(indexPrevSpace, indexNextSpace).replace(/[.,:;!?]$/,'');
      activeSegmentData['sourceLanguage'] = drupalSettings.sourceLanguage;
      activeSegmentData['targetLanguage'] = drupalSettings.targetLanguage;

      editorPairs[activeEditorId].activeSegmentId = activeSegmentData['segmentId'];
      editorPairs[activeEditorId].activeWord = activeSegmentData['word'];
      editorPairs[activeEditorId].activeSegmentStrippedText = activeSegmentData['segmentStrippedText'];
      editorPairs[activeEditorId].activeSegmentHtmlText = activeSegmentData['segmentHtmlText'];
      EditorPair.prototype.markSegment('active');

      // Return the word without extra characters.
      return activeSegmentData;
    }
    // Selection starts at the 0 index of the text node and/or there's no previous text node in contents.
    return null;
  };

  // Resets the active segments in the editor, so that there is only 1 active.
  // @todo No iteration, hardcode the editors for now or make them work in pairs.
  EditorPair.prototype.resetActiveSegment = function () {
    var translationSegment = CKEDITOR.instances[editorPairs[activeEditorId].activeEditorName].document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    var relatedEditor = EditorPair.prototype.getRelatedEditor(CKEDITOR.instances[editorPairs[activeEditorId].activeEditorName]);
    var relatedSegment = relatedEditor.document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    translationSegment.removeAttribute(attrStatusActive);
    relatedSegment.removeAttribute(attrStatusActive);
  };

  // Things to do after the content is selected.
  function refreshActiveContent() {
    // We only display the clicked texts when the plugin is enabled/clicked -
    // the area below exists (depends on the state).
    if (editorPairs[activeEditorId].activeSegmentId && editorPairs[activeEditorId].activeEditorName) {
      EditorPair.prototype.resetActiveSegment();
    }

    var selectedContent = EditorPair.prototype.getActiveContent();
    // If the segment is clicked, display it.
    if (selectedContent) {
      // Display the segment as active.
      EditorPair.prototype.displayContent();

      // Do the http request to the memory.
      getDataFromMemory(selectedContent);
    }
    // If something else is clicked, remove the previous displayed segment.
    else {
      editorPairs[activeEditorId].areaBelow.innerHTML = '';
    }
  }

  // Displays the selected segment and word in the area below the editor.
  EditorPair.prototype.displayContent = function () {
    // Remove the previous segment, if it exists.
    var activeSegment = document.getElementsByClassName('active-segment-text');
    if (activeSegment) {
      editorPairs[activeEditorId].areaBelow.innerHTML = '';
    }

    EditorPair.prototype.setCounterCompletedSegments();
    EditorPair.prototype.createNewParagraph('tmgmt-active-segment-div', 'Selected segment', editorPairs[activeEditorId].activeSegmentStrippedText, editorPairs[activeEditorId].areaBelow, 'active-segment');
    EditorPair.prototype.createNewParagraph('tmgmt-active-word-div', 'Selected word', editorPairs[activeEditorId].activeWord, editorPairs[activeEditorId].areaBelow, 'active-word');

    wrappers[editorPairs[activeEditorId].id].appendChild(editorPairs[activeEditorId].areaBelow);
  };

  // Helper function to create and update the counter of completed segments.
  EditorPair.prototype.setCounterCompletedSegments = function () {
    var htmldata = CKEDITOR.currentInstance.getData();
    var regex = new RegExp(attrStatusCompleted, 'g');
    var count = (htmldata.match(regex) || []).length;
    var countAll = (htmldata.match(/<\/tmgmt-segment>/g) || []).length;

    if (!document.getElementsByClassName('segment-status-counter')[0]) {
      var segmentStatusCounter = count.toString() + '/' + countAll;
      EditorPair.prototype.createNewParagraph('tmgmt-segment-counter-div','Number of completed segments', segmentStatusCounter, editorPairs[activeEditorId].areaBelow, 'segment-status-counter');
    }
    else {
      document.getElementsByClassName('segment-status-counter')[0].innerHTML = count + '/' + countAll;
    }
  };

  // Helper function for creating new paragraph in the area below.
  EditorPair.prototype.createNewParagraph = function (parentDiv, title, text, targetDiv, paragraphClassName) {
    var wrapper = document.createElement('div');
    wrapper.className = parentDiv;
    var p1 = document.createElement('P');
    p1.className = 'tmgmt-segments-title';
    p1.appendChild(document.createTextNode(title + ':'));
    wrapper.appendChild(p1);
    var p2 = document.createElement('P');
    p2.className = paragraphClassName;
    p2.appendChild(document.createTextNode(text));
    wrapper.appendChild(p2);
    targetDiv.appendChild(wrapper);
  };

  // Makes a dummy suggestion for the selected segment translation.
  EditorPair.prototype.suggestTranslation = function (jsonData, index, selectedSegment, targetDiv) {
    var wrapperClass = 'tmgmt-suggested-translation-div-editor-' + editorPairs[activeEditorId].id + '-index-' + index;
    EditorPair.prototype.createNewParagraph(wrapperClass, 'Suggested translation', jsonData.trSegmentHtmlText, targetDiv, 'suggested-translation-text');

    var wrapper = document.getElementsByClassName(wrapperClass);
    var btn = document.createElement('button');
    var t = document.createTextNode('Use suggestion');
    btn.appendChild(t);
    btn.className = 'button';
    btn.setAttribute('type', 'button');
    btn.id = 'btn-use-suggestion-' + index;
    wrapper[0].appendChild(btn);

    btn.addEventListener('click', function (event) {
      event.preventDefault();
      EditorPair.prototype.addSuggestion(jsonData, selectedSegment);
      targetDiv.parentNode.removeChild(targetDiv);
    });
  };

  // Adds the suggestion in the translation editor.
  EditorPair.prototype.addSuggestion = function (jsonData, selectedSegment) {
    var editor = CKEDITOR.currentInstance;
    var editorData = editor.getData();
    var replaced_text = editorData.replace(selectedSegment, jsonData.trSegmentHtmlText);
    editor.setData(replaced_text);
    var sourceSegment = editor.document.$.getElementById(jsonData.sourceSegmentId);
    sourceSegment.setAttribute(attrSource, 'memory');
    sourceSegment.setAttribute(attrQuality, jsonData.quality);
    enableListener = false;
  };

  // Marks active and completed segments in the editor.
  // @todo This marker should be added only when editing.
  EditorPair.prototype.markSegment = function (status) {
    var translationSegment = CKEDITOR.currentInstance.document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    var relatedEditor = EditorPair.prototype.getRelatedEditor(CKEDITOR.currentInstance);
    var relatedSegment = relatedEditor.document.$.getElementById(editorPairs[activeEditorId].activeSegmentId);
    if (status === 'active') {
      translationSegment.setAttribute(attrStatusActive, '');
      relatedSegment.setAttribute(attrStatusActive, '');
    }
    else if (status === 'completed') {
      translationSegment.setAttribute(attrStatusCompleted, '');
      relatedSegment.setAttribute(attrStatusCompleted, '');
    }
  };

})(jQuery, Drupal, CKEDITOR);

/**
 * If we want to automatically enable the showsegments command when the editor loads.
 *
 *		config.startupOutlineBlocks = true;
 *
 * @cfg {Boolean} [startupOutlineBlocks=false]
 * @member CKEDITOR.config
 */
