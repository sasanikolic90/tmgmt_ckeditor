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

      editor.on('contentDom', function () {
        var editable = editor.editable();
        editable.attachListener(editable, 'click', function (evt) {
          // We only display the clicked texts when the plugin is enabled/clicked -
          // the segments-div exists (depends on the state).
          var segmentsDiv = document.getElementById('segments-div');
          if (segmentsDiv) {
            resetActiveSegment();
            var selectedWord = [getCurrentContent()];
            // Display the segment as active.
            // evt.data.getTarget().setAttribute('class', 'active-segment');
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

          // Get clicked segment id.
          var segmentID = startNode.$.parentElement.getAttribute('id');
          var word = startNode.getText().substring(indexPrevSpace, indexNextSpace).replace(/[.,:;!?]$/,'');
          var segment = startNode.getText();

          markActiveSegment(segmentID);

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
    var activeSegment = document.getElementsByClassName('active-segment-text');
    if (activeSegment) {
      segmentsDiv.innerHTML = '';
    }

    var segmentsTitle = document.createTextNode('Current segment:');
    segmentsDiv.appendChild(segmentsTitle);

    var para = document.createElement('P');
    para.className = 'active-segment-text';
    var segmentText = document.createTextNode(data);
    para.appendChild(segmentText);
    segmentsDiv.appendChild(para);
    translationDiv.appendChild(segmentsDiv);
  }

  // Resets the active segments in the editor, so that there is only 1 active.
  function resetActiveSegment() {
    for (var i in CKEDITOR.instances) {
      var activeSegments = [].slice.apply(CKEDITOR.instances[i].document.$.getElementsByClassName('active-segment'));
      for (var j = 0; j < activeSegments.length; j++) {
        activeSegments[j].className = activeSegments[j].className.replace(/ *\bactive-segment\b/g, "inactive-segment");
      }
    }
    /*for (var i in CKEDITOR.instances) {
      var activeSegments = CKEDITOR.instances[i].document.$.getElementsByClassName('active-segment');
      for (var j = 0; j < activeSegments.length; j++) {
        activeSegments[j].className = 'inactive-segment';
      }
    }*/
  }

  function markActiveSegment(segmentID) {
    for (var i in CKEDITOR.instances) {
      var sameSegment = CKEDITOR.instances[i].document.$.getElementById(segmentID);
      if (sameSegment) {
        sameSegment.className = 'active-segment';
      }
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
