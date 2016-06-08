/**
 * @file
 * CKEditor plugin to display TMGMT segments.
 */

(function ($, Drupal, CKEDITOR) {
  'use strict';

  var tag = 'tmgmt-segment';

  var commandDefinition = {
    readOnly: 1,
    preserveState: true,
    editorFocus: false,

    exec: function (editor) {
      this.toggleState();
      // this.displayContext(editor);
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
        if (editor.name !== 'edit-body0value-source-value') {
          CKEDITOR.instances['edit-body0value-source-value'].editable()[funcName]('cke_show_segments');
        }

        // Display the segments' content below the translate editor if the
        // plugin is enabled.
        if (this.state === 1) {
          var translationDiv = document.getElementsByClassName('tmgmt-ui-data-item-translation')[1];
          // Put the segments into <p> tags.
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

          // @to-do CLEAR STYLING
        }
      }
    }
/*  This displays all segments. For now, we don't need this -
    (just in case, I'm keeping it until next refactoring).
    displayContext: function (editor) {
      var data = editor.getData();
      var segmentedData = data.match(/<tmgmt-segment id=["'](.*?)["']>(.*?)<\/tmgmt-segment>/g);
      if (segmentedData) {
        var texts = segmentedData.map(function (val) {
          return val.replace(/(<([^>]+)>)/ig,'');
        });

        // Do this only when we click on the 'Show segments' icon.
        if (this.state === 1) {
          // Display the segments' context below the translate editor.
          var translationDiv = document.getElementsByClassName('tmgmt-ui-data-item-translation')[1];
          // Put the segments into <p> tags.
          var segmentsDiv = document.createElement('div');
          segmentsDiv.id = 'segments-div';
          translationDiv.appendChild(segmentsDiv);
          displayContent(texts);
        }
        // Remove the segments div when disabling the 'Show segments'.
        else {
          document.getElementById('segments-div').parentNode.removeChild(document.getElementById('segments-div'));
        }
      }
    }*/
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

      editor.on('contentDom', function () {
        var editable = editor.editable();
        editable.attachListener(editable, 'click', function () {
          // We only display the clicked texts when the plugin is enabled/clicked -
          // the segments-div exists (depends on the state).
          var segmentsDiv = document.getElementById('segments-div');

          if (segmentsDiv) {
            var selectedWord = [getCurrentContent()];
            displayContent(selectedWord);
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

      // Gets the clicked word.
      function getCurrentContent() {
        var range = editor.getSelection().getRanges()[0];
        var startNode = range.startContainer;
        if (startNode.type === CKEDITOR.NODE_TEXT && range.startOffset) {
          var indexPrevSpace = startNode.getText().lastIndexOf(' ', range.startOffset) + 1;
          var indexNextSpace = startNode.getText().indexOf(' ', range.startOffset);
          if (indexPrevSpace === -1) {
            indexPrevSpace = 0;
          }
          if (indexNextSpace === -1) {
            indexNextSpace = startNode.getText().length;
          }

          // var filteredWord = startNode.getText().substring(indexPrevSpace,indexNextSpace);

          // Get clicked segment id.
          var segmentID = startNode.$.parentElement.getAttribute('id');

          // If the segment with the same ID exists in the source, Search for it
          // and make it red.
          if (CKEDITOR.instances['edit-body0value-source-value'].document.$.getElementById(segmentID)) {
            startNode.$.parentElement.setAttribute('class', 'active-segment');
            // startNode.$.parentElement.style.color = 'red';
            CKEDITOR.instances['edit-body0value-source-value'].document.$.getElementById(segmentID).setAttribute('class', 'active-segment');
          }

          // Range at the non-zero position of a text node.
          var word = startNode.getText().substring(indexPrevSpace, indexNextSpace).replace(/[.,:;!?]$/,'');
          var segment = startNode.getText();

          // Return the word without extra characters.
          return segment + '; ' + word;
        }
        // Selection starts at the 0 index of the text node and/or there's no previous text node in contents.
        return null;
      }
    }
  });

  function displayContent(data) {
    var translationDiv = document.getElementsByClassName('tmgmt-ui-data-item-translation')[1];
    var segmentsDiv = document.getElementById('segments-div');

    // Remove the previous segment, if it exists.
    var activeSegment = document.getElementsByClassName('segment-text');
    if (activeSegment) {
      segmentsDiv.remove('active-segment-text');
    }

    var segmentsTitle = document.createTextNode('Segments:');
    segmentsDiv.appendChild(segmentsTitle);

    var para = document.createElement('P');
    para.className = 'active-segment-text';
    var segmentText = document.createTextNode(data);
    para.appendChild(segmentText);
    segmentsDiv.appendChild(para);
    translationDiv.appendChild(segmentsDiv);
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
