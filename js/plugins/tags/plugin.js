/**
 * @file
 * CKEditor plugin to display masked HTML tags inside segments.
 */

(function ($, Drupal, CKEDITOR) {
  'use strict';

  var tag = 'tmgmt-tag';

  var commandDefinition = {
    readOnly: 1,
    preserveState: true,
    editorFocus: false,
    startDisabled: true,

    exec: function (editor) {
      this.toggleState();
      this.refresh(editor);
    },

    refresh: function(editor) {
      if (editor.document) {
        // showSegments turns inactive after editor loses focus when in inline.
        var showTags = (this.state === CKEDITOR.TRISTATE_ON && (editor.elementMode !== CKEDITOR.ELEMENT_MODE_INLINE || editor.focusManager.hasFocus));

        var funcName = showTags ? 'attachClass' : 'removeClass';
        editor.editable()[funcName]('cke_show_tags');
      }
    }
  };

  CKEDITOR.plugins.add('tmgmt_tags', {
    lang: 'en',
    icons: 'showtags',
    hidpi: true,
    onLoad: function () {
      var cssStd, cssImgLeft, cssImgRight;

      cssStd = cssImgLeft = cssImgRight = '';

      cssStd += '.cke_show_tags ' + tag + '{' +
        '}';
      cssImgLeft += '.cke_show_tags ' + tag + '::before{' +
        'content:' + '"\u25B7"' + ';' + 'padding-right: 0.5em;' +
        '}';
      cssImgRight += '.cke_show_tags ' + tag + '::after{' +
        'content:' + '"\u25C3"' + ';' + 'padding-left: 0.5em;' +
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

      var command = editor.addCommand('showtags', commandDefinition);
      command.canUndo = false;

      if (editor.config.startupOutlineBlocks) {
        command.setState(CKEDITOR.TRISTATE_ON);
      }

      editor.ui.addButton && editor.ui.addButton('tmgmt_tags', {
        icon: 'showtags',
        label: editor.lang.tmgmt_tags.buttonTitle,
        command: 'showtags',
        toolbar: 'tools,20'
      });


      // Refresh the command on focus/blur in inline.
      if (editor.elementMode === CKEDITOR.ELEMENT_MODE_INLINE) {
        editor.on('focus', onFocusBlur);
        editor.on('blur', onFocusBlur);
      }

      // Refresh the command on setData.
      editor.on('contentDom', function() {
        if (command.state !== CKEDITOR.TRISTATE_DISABLED) {
          command.refresh(editor);
        }
      });

      function onFocusBlur() {
        command.refresh(editor);
      }
    }
  });
})(jQuery, Drupal, CKEDITOR);

/**
 * If we want to automatically enable the showsegments command when the editor loads.
 *
 *		config.startupOutlineBlocks = true;
 *
 * @cfg {Boolean} [startupOutlineBlocks=false]
 * @member CKEDITOR.config
 */
