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
          if (!document.getElementById('segments-div')) {
            var translationDiv = document.getElementsByClassName('tmgmt-ui-data-item-translation')[1];
            var segmentsDiv = document.createElement('div');
            segmentsDiv.id = 'segments-div';
            translationDiv.appendChild(segmentsDiv);

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
          if (document.getElementById('segments-div')) {
            document.getElementById('segments-div').parentNode.removeChild(document.getElementById('segments-div'));

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
          markActiveSegment(element.getId(), 'completed');

          setCounterCompletedSegments();
        }
      });

      editor.on('instanceReady', function () {
        // When the data is loaded and the translation editor is empty, populate
        // the content with the source content.
        var sourceEditor = CKEDITOR.instances['edit-body0value-source-value'];
        var translationEditor = CKEDITOR.instances['edit-body0value-translation-value'];
        if (!translationEditor.getData()) {
          translationEditor.setData(sourceEditor.getData());
        }
      });

      editor.on('contentDom', function () {
        var editable = editor.editable();
        editable.focus();

        // Things to do when a word/segment is clicked.
        editable.attachListener(editable, 'click', function (evt) {
          // We only display the clicked texts when the plugin is enabled/clicked -
          // the segments-div exists (depends on the state).
          var segmentsDiv = document.getElementById('segments-div');
          if (segmentsDiv) {
            resetActiveSegment();
            var selectedContent = getActiveContent();

            // If the segment is clicked, display it.
            if (selectedContent) {
              var selectedSegment = selectedContent.split(';')[0];
              var selectedWord = selectedContent.split(';')[1];
              // Display the segment as active.
              displayContent(selectedSegment, selectedWord);

              xmlhttp.onreadystatechange = function() {
                if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                  var jsonData = JSON.parse(xmlhttp.responseText);
                  suggestTranslation(jsonData.translatedSegment, selectedSegment, segmentsDiv);
                }
              };
              xmlhttp.open('GET', drupalSettings.path.baseUrl + 'tmgmt_ckeditor/get.json?segment=' + selectedSegment, true);
              xmlhttp.send();
            }
            // If something else is clicked, remove the previous displayed segment.
            else {
              segmentsDiv.innerHTML = '';
            }
          }
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

      function onFocusBlur() {
        command.refresh(editor);
      }

      // Gets the selected segment and word.
      function getActiveContent() {
        var range = editor.getSelection().getRanges()[0];
        var startNode = range.startContainer;
        if (startNode.type === CKEDITOR.NODE_TEXT && range.startOffset && startNode.getParent().getName() === tag) {
          var indexPrevSpace = startNode.getText().lastIndexOf(' ', range.startOffset) + 1;
          var indexNextSpace = startNode.getText().indexOf(' ', range.startOffset);
          if (indexPrevSpace === -1) {
            indexPrevSpace = 0;
          }
          if (indexNextSpace === -1) {
            indexNextSpace = startNode.getText().length;
          }

          // Get clicked segment id.
          var segmentId = startNode.getParent().getAttribute('id');
          var word = startNode.getText().substring(indexPrevSpace, indexNextSpace).replace(/[.,:;!?]$/,'');
          var segment = startNode.getText();

          markActiveSegment(segmentId, 'active');

          // Return the word without extra characters.
          return segment + '; ' + word + ';' + segmentId;
        }
        // Selection starts at the 0 index of the text node and/or there's no previous text node in contents.
        return null;
      }
    }
  });

  // Displays the selected segment and word in the area below the editor.
  function displayContent(selectedSegment, selectedWord) {
    var translationDiv = document.getElementsByClassName('tmgmt-ui-data-item-translation')[1];
    var segmentsDiv = document.getElementById('segments-div');

    // Remove the previous segment, if it exists.
    var activeSegment = document.getElementsByClassName('active-segment-text');
    if (activeSegment) {
      segmentsDiv.innerHTML = '';
    }

    setCounterCompletedSegments();
    createNewParagraph('Selected segment', selectedSegment, segmentsDiv, 'active-segment');
    createNewParagraph('Selected word', selectedWord, segmentsDiv, 'active-word');

    translationDiv.appendChild(segmentsDiv);
  }

  // Helper function to create and update the counter of completed segments.
  function setCounterCompletedSegments() {
    var htmldata = CKEDITOR.currentInstance.getData();
    var regex = new RegExp(attrStatusCompleted, 'g');
    var count = (htmldata.match(regex) || []).length;
    var countAll = (htmldata.match(/<\/tmgmt-segment>/g) || []).length;

    if (!document.getElementsByClassName('segment-status-counter')[0]) {
      var segmentsDiv = document.getElementById('segments-div');
      var segmentStatusCounter = count.toString() + '/' + countAll;
      createNewParagraph('Number of completed segments', segmentStatusCounter, segmentsDiv, 'segment-status-counter');
    }
    else {
      document.getElementsByClassName('segment-status-counter')[0].innerHTML = count + '/' + countAll;
    }
  }

  // Helper function for creating new paragraph in the area below.
  function createNewParagraph(title, text, targetDiv, className) {
    var segmentsTitle = document.createTextNode(title + ':');
    targetDiv.appendChild(segmentsTitle);
    var p1 = document.createElement('P');
    p1.className = className;
    var segmentText = document.createTextNode(text);
    p1.appendChild(segmentText);
    targetDiv.appendChild(p1);
  }

  // Makes a dummy suggestion for the selected segment translation.
  function suggestTranslation(jsonData, selectedSegment, segmentsDiv) {
    createNewParagraph('Suggested translation', jsonData, segmentsDiv, 'suggested-translation');

    var btn = document.createElement('button');
    var t = document.createTextNode('Use suggestion');
    btn.appendChild(t);
    btn.className = 'button';
    btn.setAttribute('type', 'button');
    btn.id = 'btn-use-suggestion';
    segmentsDiv.appendChild(btn);

    document.getElementById('btn-use-suggestion').addEventListener('click', function () {
      addSuggestion(jsonData, selectedSegment);
    });
  }

  // Resets the active segments in the editor, so that there is only 1 active.
  // @todo No iteration, hardcode the editors for now or make them work in pairs.
  function resetActiveSegment() {
    for (var i in CKEDITOR.instances) {
      var segments = CKEDITOR.instances[i].document.$.getElementsByTagName(tag);
      for (var j = 0; j < segments.length; j++) {
        if (segments[j].getAttribute(attrStatusActive)) {
          segments[j].removeAttribute(attrStatusActive);
        }
      }
    }
  }

  // Marks active segments in the editor.
  // @todo This marker should be added only when editing.
  // @todo No iteration, hardcode the editors for now or make them work in pairs.
  function markActiveSegment(segmentId, status) {
    for (var i in CKEDITOR.instances) {
      var sameSegment = CKEDITOR.instances[i].document.$.getElementById(segmentId);
      if (sameSegment) {
        if (status === 'active') {
          sameSegment.setAttribute(attrStatusActive, 'active');
        }
        else if (status === 'completed') {
          sameSegment.setAttribute(attrStatusCompleted, 'completed');
        }
      }
    }
  }

  // Adds the suggestion in the translation editor.
  function addSuggestion(jsonData, selectedSegment) {
    var editor = CKEDITOR.instances['edit-body0value-translation-value'];
    var editorData = editor.getData();
    var replaced_text = editorData.replace(selectedSegment, jsonData);
    editor.setData(replaced_text);
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
