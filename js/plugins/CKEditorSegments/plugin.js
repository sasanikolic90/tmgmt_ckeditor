/**
 * @file
 * CKEditor plugin to display TMGMT segments.
 */

(function () {
  'use strict';

  var tag = 'tmgmt-segment';

  var commandDefinition = {
    readOnly: 1,
    preserveState: true,
    editorFocus: false,

    exec: function (editor) {
      this.toggleState();
      this.displayContext(editor);
      this.refresh(editor);
    },

    refresh: function (editor) {
      if (editor.document) {
        // showSegments turns inactive after editor loses focus when in inline.
        var showSegments = (this.state === CKEDITOR.TRISTATE_ON &&
        (editor.elementMode !== CKEDITOR.ELEMENT_MODE_INLINE || editor.focusManager.hasFocus));

        var funcName = showSegments ? 'attachClass' : 'removeClass';
        editor.editable()[funcName]('cke_show_segments');

        if (editor.name !== 'edit-body0value-source-value') {
          CKEDITOR.instances['edit-body0value-source-value'].editable()[funcName]('cke_show_segments');
        }
      }
    },
    displayContext: function (editor) {
      // Do this only when we are on translation page.
      if (document.getElementsByClassName('tmgmt-ui-review').length > 0) {
        var data = editor.getData();
        var segmented_data = data.match(/<tmgmt-segment id=["'](.*?)["']>(.*?)<\/tmgmt-segment>/g);
        if (segmented_data) {
          var texts = segmented_data.map(function (val) {
            return val.replace(/(<([^>]+)>)/ig,'');
          });

          // Do this only when we click on the 'Show segments' icon.
          if (this.state === 1) {
            // Display the segments' context below the translate editor.
            var translation_div = document.getElementsByClassName('tmgmt-ui-data-item-translation')[1];
            var segments_div = document.createElement('div');
            segments_div.id = 'segments-div';

            // Create paragraphs for each segment context.
            var para = [];
            var content;
            for (var i = 0; i < texts.length; i++) {
              para[i] = document.createElement("P");
              content = document.createTextNode(texts[i]);
              para[i].appendChild(content);
              segments_div.appendChild(para[i]);
            }
            // var newContent = document.createTextNode(texts.join(", "));
            // segments_div.appendChild(newContent);
            translation_div.appendChild(segments_div);
          }
          // Remove the segments div when disabling the 'Show segments'.
          else {
            document.getElementById('segments-div').parentNode.removeChild(document.getElementById('segments-div'));
          }
        }
      }
    }
  };

  CKEDITOR.plugins.add('CKEditorSegments', {
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
        'content:url(' + CKEDITOR.getUrl(path + 'images/arrow-right-20.png') + ')' +
        '}';
      cssImgRight += '.cke_show_segments ' + tag + '::after{' +
        'content:url(' + CKEDITOR.getUrl(path + 'images/arrow-left-20.png') + ')' +
        '}';

      CKEDITOR.addCss(cssStd.concat(cssImgLeft, cssImgRight));
    },

    init: function (editor) {
      if (editor.blockless) {
        return;
      }

      var command = editor.addCommand('showsegments', commandDefinition);
      command.canUndo = false;

      if (editor.config.startupOutlineBlocks) {
        command.setState(CKEDITOR.TRISTATE_ON);
      }

      editor.ui.addButton && editor.ui.addButton('CKEditorSegments', {
        icon: 'showsegments',
        label: editor.lang.CKEditorSegments.buttonTitle,
        command: 'showsegments',
        toolbar: 'tools,20'
      });

      // Refresh the command on setData.
      editor.on('mode', function() {
        if (command.state !== CKEDITOR.TRISTATE_DISABLED) {
          command.refresh(editor);
        }
      });

      editor.on('contentDom', function () {
        var editable = editor.editable();

        editable.attachListener(editable, 'click', function() {
          var selectedWord = getCurrentWord();
          console.log(selectedWord);
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
      function getCurrentWord() {
        var range = editor.getSelection().getRanges()[ 0 ],
          startNode = range.startContainer;
        if ( startNode.type == CKEDITOR.NODE_TEXT && range.startOffset ) {
          var indexPrevSpace = startNode.getText().lastIndexOf(' ', range.startOffset) + 1;
          var indexNextSpace = startNode.getText().indexOf(' ', range.startOffset);
          if(indexPrevSpace == -1) {
            indexPrevSpace=0;
          }
          if(indexNextSpace == -1) {
            indexNextSpace = startNode.getText().length;
          }

          var filteredWord = startNode.getText().substring(indexPrevSpace,indexNextSpace);

          // Range at the non-zero position of a text node.

          return startNode.getText().substring(indexPrevSpace,indexNextSpace);
        }
        // Selection starts at the 0 index of the text node and/or there's no previous text node in contents.
        return null;
      }
    }
  });
})();

/**
 * If we want to automatically enable the showsegments command when the editor loads.
 *
 *		config.startupOutlineBlocks = true;
 *
 * @cfg {Boolean} [startupOutlineBlocks=false]
 * @member CKEDITOR.config
 */
