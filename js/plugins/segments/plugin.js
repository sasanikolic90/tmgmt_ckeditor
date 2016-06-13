/**
 * @file
 * CKEditor plugin to display TMGMT segments.
 */

(function ($, Drupal, CKEDITOR) {
  'use strict';

  var tag = 'tmgmt-segment';
  var dummyTranslation = 'Dummy translated segment';

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
          var translationDiv = document.getElementsByClassName('tmgmt-ui-data-item-translation')[1];
          var segmentsDiv = document.createElement('div');
          segmentsDiv.id = 'segments-div';
          translationDiv.appendChild(segmentsDiv);
        }
        // Remove the segments display area below the editor when we disable
        // the plugin.
        else {
          if (document.getElementById('segments-div')) {
            document.getElementById('segments-div').parentNode.removeChild(document.getElementById('segments-div'));
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
              var selectedSegmentId = selectedContent.split(';')[2];
              // Display the segment as active.
              displayContent(selectedSegment, selectedWord);
              suggestTranslation(selectedSegmentId, segmentsDiv);

              document.getElementById('btn-use-suggestion').addEventListener('click', function () {
                addSuggestion(selectedSegment);
              });
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

          markActiveSegment(segmentId);

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

    var segmentsTitle = document.createTextNode('Selected segment:');
    segmentsDiv.appendChild(segmentsTitle);
    var p1 = document.createElement('P');
    p1.className = 'active-segment-text';
    var segmentText = document.createTextNode(selectedSegment);
    p1.appendChild(segmentText);
    segmentsDiv.appendChild(p1);

    var selectedWordTitle = document.createTextNode('Selected word:');
    segmentsDiv.appendChild(selectedWordTitle);
    var p2 = document.createElement('P');
    p2.className = 'active-word-text';
    var selectedWordText = document.createTextNode(selectedWord);
    p2.appendChild(selectedWordText);
    segmentsDiv.appendChild(p2);

    translationDiv.appendChild(segmentsDiv);
  }

  // Makes a dummy suggestion for the selected segment translation.
  function suggestTranslation(selectedSegmentId, segmentsDiv) {
    var sugTranslationTitle = document.createTextNode('Suggested translation:');
    segmentsDiv.appendChild(sugTranslationTitle);
    var sugTrP = document.createElement('P');
    sugTrP.className = 'suggested-translation';
    var sugTranslation = document.createTextNode(dummyTranslation + ' ' + selectedSegmentId);
    sugTrP.appendChild(sugTranslation);
    segmentsDiv.appendChild(sugTrP);

    var btn = document.createElement('button');
    var t = document.createTextNode('Use suggestion');
    btn.appendChild(t);
    btn.className = 'button';
    btn.setAttribute('type', 'button');
    btn.id = 'btn-use-suggestion';
    segmentsDiv.appendChild(btn);
  }

  // Resets the active segments in the editor, so that there is only 1 active.
  // @todo No inactive class.
  function resetActiveSegment() {
    for (var i in CKEDITOR.instances) {
      var activeSegments = [].slice.apply(CKEDITOR.instances[i].document.$.getElementsByClassName('active-segment'));
      for (var j = 0; j < activeSegments.length; j++) {
        activeSegments[j].className = activeSegments[j].className.replace(/ *\bactive-segment\b/g, 'inactive-segment');
      }
    }
    /*for (var i in CKEDITOR.instances) {
      var activeSegments = CKEDITOR.instances[i].document.$.getElementsByClassName('active-segment');
      for (var j = 0; j < activeSegments.length; j++) {
        activeSegments[j].className = 'inactive-segment';
      }
    }*/
  }

  // Marks active segments in the editor.
  // @todo This marker should be added only when editing.
  function markActiveSegment(segmentId) {
    for (var i in CKEDITOR.instances) {
      var sameSegment = CKEDITOR.instances[i].document.$.getElementById(segmentId);
      if (sameSegment) {
        sameSegment.className = 'active-segment';
      }
    }
  }

  // Adds the suggestion in the translation editor.
  function addSuggestion(selectedSegment) {
    var editor = CKEDITOR.instances['edit-body0value-translation-value'];
    var editorData = editor.getData();
    var newSegmentText = document.getElementsByClassName('suggested-translation')[0].innerHTML;
    var replaced_text = editorData.replace(selectedSegment, newSegmentText);
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
