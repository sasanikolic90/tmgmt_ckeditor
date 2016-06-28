/**
 * @file
 * CKEditor plugin to display TMGMT segments.
 */

(function ($, Drupal, CKEDITOR) {
  'use strict';

  var tag = 'tmgmt-segment';
  var xmlhttp;
  var attrStatusCompleted = 'data-tmgmt-segment-completed-status';
  var attrStatusActive = 'data-tmgmt-segment-active-status';
  var attrSource = 'data-tmgmt-segment-source';
  var attrQuality = 'data-tmgmt-segment-quality';
  var editorTimer = null;
  var disableListener = false;
  var wrappers = [].slice.call(document.getElementsByClassName('tmgmt-ui-data-item-translation')).splice(1,3);
  var editor_id = null;
  var activeSegmentId;
  var activeEditorName;

  if (window.XMLHttpRequest) {
    // code for IE7+, Firefox, Chrome, Opera, Safari
    xmlhttp = new XMLHttpRequest();
  }

  var commandDefinition = {
    readOnly: 1,
    preserveState: true,
    editorFocus: false,

    exec: function (editor) {
      this.toggleState();
      this.refresh(editor);
    },

    refresh: function (editor) {
      if (editor.document) {
        // showSegments turns inactive after editor loses focus when in inline.
        var showSegments = (this.state === CKEDITOR.TRISTATE_ON &&
        (editor.elementMode !== CKEDITOR.ELEMENT_MODE_INLINE || editor.focusManager.hasFocus));

        var matchId = editor.name.match(/\d+/);
        var editorId = parseInt(matchId[0], 10);

        var funcName = showSegments ? 'attachClass' : 'removeClass';
        editor.editable()[funcName]('cke_show_segments');

        // Display segments also in the source editor.
        for (var i in CKEDITOR.instances) {
          CKEDITOR.instances[i].editable()[funcName]('cke_show_segments');
        }

        // Display the segments' content below the translate editor if the
        // plugin is enabled.
        if (this.state === 1) {
          // This check is because when clicking "Use suggestion", the editors
          // refresh, but the status is still active and it adds a new div.
          if (document.getElementsByClassName('tmgmt-segments')[editorId].innerHTML === '') {
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
        }
        // Remove the segments display area below the editor when we disable
        // the plugin.
        else {
          if (document.getElementsByClassName('tmgmt-segments')[editorId]) {
            // document.getElementsByClassName('tmgmt-segments')[editorId].parentNode.removeChild(document.getElementsByClassName('tmgmt-segments')[editorId]);
            document.getElementsByClassName('tmgmt-segments')[editorId].innerHTML = '';
            // Remove the context menu item.
            editor.removeMenuItem('setStatusItem');
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
      var cssStd, cssImgLeft, cssImgRight,
        path = CKEDITOR.getUrl(this.path);

      cssStd = cssImgLeft = cssImgRight = '';

      cssStd += '.cke_show_segments ' + tag + '{' +
        '}';
      cssImgLeft += '.cke_show_segments ' + tag + '::before{' +
        'content:' + '"\u25B6"' + ';' + 'padding-right: 0.5em;' +
        '}';
      cssImgRight += '.cke_show_segments ' + tag + '::after{' +
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

      // Refresh the command on setData.
      editor.on('mode', function () {
        if (command.state !== CKEDITOR.TRISTATE_DISABLED) {
          command.refresh(editor);
        }
      });

      if (editor.contextMenu) {
        editor.contextMenu.addListener(function (element, selection) {
          if (element.getAscendant(tag, true)) {
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
          markSegment(element.getId(), 'completed');

          setCounterCompletedSegments();
        }
      });

      editor.on('instanceReady', function () {
        // When the data is loaded and the translation editor is empty, populate
        // the content with the corresponding source content.
        var key;
        var instance;
        var owns = Object.prototype.hasOwnProperty;

        for (key in CKEDITOR.instances) {
          if (owns.call(CKEDITOR.instances, key)) {
            instance = CKEDITOR.instances[key];

            // If we find a translation editor without data, populate it from the
            // corresponding source editor.
            var translationNameMatch = instance.name.match(/.*value-translation-value$/);
            if (translationNameMatch != null && !instance.getData()) {
              var sourceEditorName = instance.name.replace('value-translation-value', 'value-source-value');
              instance.setData(CKEDITOR.instances[sourceEditorName].getData());

              // Get the editor id.
              var matchId = instance.name.match(/\d+/);
              var editorId = parseInt(matchId[0], 10);
              wrappers[editorId].setAttribute('data-tmgmt-segments-info-area', editorId);
              var segmentsDiv = document.createElement('div');
              segmentsDiv.className = 'tmgmt-segments';
              wrappers[editorId].appendChild(segmentsDiv);
            }
          }
        }
      });

      editor.on('contentDom', function () {
        var editable = editor.editable();
        editable.focus();

        // Things to do when a word/segment is clicked.
        editable.attachListener(editable, 'click', function (evt) {
          // Remove segmentsDiv when changing editor.
          if (editor_id != null && parseInt(editor.name.match(/\d+/)[0], 10) !== editor_id) {
            var segmentsDiv = document.getElementsByClassName('tmgmt-segments')[editor_id];
            segmentsDiv.innerHTML = '';
          }
          // Set the editor_id to the newly clicked editor's id.
          editor_id = parseInt(editor.name.match(/\d+/)[0], 10);
          refreshActiveContent();
        });
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

      // Set the source data attribute to user if the user changes it manually.
      editor.on('change', function (evt) {
        // Exit from function when the flag is true. This is set when adding a
        // segment from the memory (clicking the button).
        if (disableListener == true) {
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

      // Things to do after the content is selected.
      function refreshActiveContent() {
        // We only display the clicked texts when the plugin is enabled/clicked -
        // the tmgmt-segments exists (depends on the state).
        // @todo this doesn't work anymore - the div is created on instanceReady
        var segmentsDiv = document.getElementsByClassName('tmgmt-segments')[editor_id];
        if (segmentsDiv) {
          if (activeSegmentId && activeEditorName) {
            resetActiveSegment(activeSegmentId, activeEditorName);
          }

          var selectedContent = getActiveContent();
          // If the segment is clicked, display it.
          if (selectedContent) {
            // Display the segment as active.
            displayContent(selectedContent['segmentText'], selectedContent['word'], editor_id);

            // Do the http request to the memory.
            getDataFromMemory(selectedContent, segmentsDiv, editor_id);
          }
          // If something else is clicked, remove the previous displayed segment.
          else {
            segmentsDiv.innerHTML = '';
          }
        }
      }

      function getDataFromMemory(selectedContent, segmentsDiv) {
        xmlhttp = new XMLHttpRequest();
        xmlhttp.onreadystatechange = function () {
          if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
            var jsonData = JSON.parse(xmlhttp.responseText);
            // Make a wrapper for suggested translations.
            var suggestedTranslations = document.createElement('div');
            suggestedTranslations.className = 'suggested-translations';
            segmentsDiv.appendChild(suggestedTranslations);

            jsonData.forEach(function (object) {
              suggestTranslation(object, selectedContent['segmentText'], suggestedTranslations);
            });
          }
        };
        xmlhttp.open('GET', drupalSettings.path.baseUrl +
          'tmgmt_ckeditor/get.json?segment=' + selectedContent['segmentText'] +
          '&lang_source=' + selectedContent['sourceLanguage'] +
          '&lang_target=' + selectedContent['targetLanguage'], true);
        xmlhttp.send();
      }

      // Gets the selected segment and word.
      function getActiveContent() {
        var range = editor.getSelection().getRanges()[0];
        var clickedSegment = range.startContainer;
        if (clickedSegment.type === CKEDITOR.NODE_TEXT && range.startOffset && clickedSegment.getParent().getName() === tag) {
          var indexPrevSpace = clickedSegment.getText().lastIndexOf(' ', range.startOffset) + 1;
          var indexNextSpace = clickedSegment.getText().indexOf(' ', range.startOffset);
          if (indexPrevSpace === -1) {
            indexPrevSpace = 0;
          }
          if (indexNextSpace === -1) {
            indexNextSpace = clickedSegment.getText().length;
          }

          // Get clicked segment id.
          var activeSegmentData = [];
          activeSegmentData['segmentId'] = clickedSegment.getParent().getAttribute('id');
          activeSegmentData['segmentText'] = clickedSegment.getText();
          activeSegmentData['word'] = clickedSegment.getText().substring(indexPrevSpace, indexNextSpace).replace(/[.,:;!?]$/,'');
          activeSegmentData['sourceLanguage'] = drupalSettings.sourceLanguage;
          activeSegmentData['targetLanguage'] = drupalSettings.targetLanguage;

          activeSegmentId = activeSegmentData['segmentId'];
          activeEditorName = editor.name;
          markSegment(activeSegmentData['segmentId'], 'active');

          // Return the word without extra characters.
          return activeSegmentData;
        }
        // Selection starts at the 0 index of the text node and/or there's no previous text node in contents.
        return null;
      }
    }
  });

  // Displays the selected segment and word in the area below the editor.
  function displayContent(selectedSegment, selectedWord) {
    var segmentsDiv = document.getElementsByClassName('tmgmt-segments')[editor_id];

    // Remove the previous segment, if it exists.
    var activeSegment = document.getElementsByClassName('active-segment-text');
    if (activeSegment) {
      segmentsDiv.innerHTML = '';
    }

    setCounterCompletedSegments();
    createNewParagraph('tmgmt-active-segment-div', 'Selected segment', selectedSegment, segmentsDiv, 'active-segment');
    createNewParagraph('tmgmt-active-word-div', 'Selected word', selectedWord, segmentsDiv, 'active-word');

    wrappers[editor_id].appendChild(segmentsDiv);
  }

  // Helper function to create and update the counter of completed segments.
  function setCounterCompletedSegments() {
    var htmldata = CKEDITOR.currentInstance.getData();
    var regex = new RegExp(attrStatusCompleted, 'g');
    var count = (htmldata.match(regex) || []).length;
    var countAll = (htmldata.match(/<\/tmgmt-segment>/g) || []).length;

    if (!document.getElementsByClassName('segment-status-counter')[0]) {
      var segmentsDiv = document.getElementsByClassName('tmgmt-segments')[editor_id];
      var segmentStatusCounter = count.toString() + '/' + countAll;
      createNewParagraph('tmgmt-segment-counter-div','Number of completed segments', segmentStatusCounter, segmentsDiv, 'segment-status-counter');
    }
    else {
      document.getElementsByClassName('segment-status-counter')[0].innerHTML = count + '/' + countAll;
    }
  }

  // Helper function for creating new paragraph in the area below.
  function createNewParagraph(parentDiv, title, text, targetDiv, paragraphClassName) {
    var wrapper = document.createElement('div');
    wrapper.className = parentDiv;
    var segmentsTitle = document.createTextNode(title + ':');
    wrapper.appendChild(segmentsTitle);
    var p1 = document.createElement('P');
    p1.className = paragraphClassName;
    var segmentText = document.createTextNode(text);
    p1.appendChild(segmentText);
    wrapper.appendChild(p1);
    targetDiv.appendChild(wrapper);
  }

  // Makes a dummy suggestion for the selected segment translation.
  function suggestTranslation(jsonData, selectedSegment, targetDiv) {
    createNewParagraph('tmgmt-suggested-translation-div-' + jsonData.targetSegmentId, 'Suggested translation', jsonData.trSegmentStrippedText, targetDiv, 'suggested-translation-text');

    var wrapper = document.getElementsByClassName('tmgmt-suggested-translation-div-' + jsonData.targetSegmentId);
    var btn = document.createElement('button');
    var t = document.createTextNode('Use suggestion');
    btn.appendChild(t);
    btn.className = 'button';
    btn.setAttribute('type', 'button');
    btn.id = 'btn-use-suggestion-' + jsonData.targetSegmentId;
    wrapper[0].appendChild(btn);

    btn.addEventListener('click', function () {
      addSuggestion(jsonData, selectedSegment);
      targetDiv.parentNode.removeChild(targetDiv);
    });
  }

  // Adds the suggestion in the translation editor.
  function addSuggestion(jsonData, selectedSegment) {
    var editor = CKEDITOR.currentInstance;
    var editorData = editor.getData();
    var replaced_text = editorData.replace(selectedSegment, jsonData.trSegmentStrippedText);
    editor.setData(replaced_text);
    var sourceSegment = editor.document.$.getElementById(jsonData.sourceSegmentId);
    sourceSegment.setAttribute(attrSource, 'memory');
    sourceSegment.setAttribute(attrQuality, jsonData.quality);
    disableListener = true;
  }

  // Resets the active segments in the editor, so that there is only 1 active.
  // @todo No iteration, hardcode the editors for now or make them work in pairs.
  function resetActiveSegment(segmentId, editorName) {
    var relatedEditorName = CKEDITOR.instances[activeEditorName].name.replace('value-translation-value', 'value-source-value');
    var translationSegment = CKEDITOR.instances[activeEditorName].document.$.getElementById(segmentId);
    var sourceSegment = CKEDITOR.instances[relatedEditorName].document.$.getElementById(segmentId);
    translationSegment.removeAttribute(attrStatusActive);
    sourceSegment.removeAttribute(attrStatusActive);
  }

  // Marks active and completed segments in the editor.
  // @todo This marker should be added only when editing.
  function markSegment(segmentId, status) {
    var relatedEditorName = CKEDITOR.currentInstance.name.replace('value-translation-value', 'value-source-value');
    var translationSegment = CKEDITOR.currentInstance.document.$.getElementById(segmentId);
    var sourceSegment = CKEDITOR.instances[relatedEditorName].document.$.getElementById(segmentId);
    if (status === 'active') {
      translationSegment.setAttribute(attrStatusActive, '');
      sourceSegment.setAttribute(attrStatusActive, '');
    }
    else if (status === 'completed') {
      translationSegment.setAttribute(attrStatusCompleted, '');
      sourceSegment.setAttribute(attrStatusCompleted, '');
    }
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
