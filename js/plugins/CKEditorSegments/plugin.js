/**
 * @file
 * CKEditor plugin to display TMGMT segments.
 */

(function () {
  'use strict';

  var commandDefinition = {
    readOnly: 1,
    preserveState: true,
    editorFocus: false,

    exec: function (editor) {
      this.toggleState();
      this.refresh(editor);
    },

    refresh: function(editor) {
      if (editor.document) {
        // showSegments turns inactive after editor loses focus when in inline.
        var showSegments = (this.state === CKEDITOR.TRISTATE_ON && (editor.elementMode !== CKEDITOR.ELEMENT_MODE_INLINE || editor.focusManager.hasFocus));

        var funcName = showSegments ? 'attachClass' : 'removeClass';
        editor.editable()[funcName]('cke_show_segments');
      }
    }
  };

  CKEDITOR.plugins.add('CKEditorSegments', {
    lang: 'en',
    icons: 'showsegments',
    hidpi: true,
    onLoad: function () {
      var tags = ['tmgmt-segment'],
        cssStd, cssImgLeft, cssImgRight,
        path = CKEDITOR.getUrl(this.path),
      // Don't apply the styles to non-editable elements and chosen ones.
      // IE8 does not support :not() pseudoclass, so we need to reset showsegments rather
      // than 'prevent' its application. We do that by additional rules.
        supportsNotPseudoclass = !(CKEDITOR.env.ie && CKEDITOR.env.version < 9),
        notDisabled = supportsNotPseudoclass ? ':not([contenteditable=false]):not(.cke_show_segments_off)' : '',
        tag, trailing;

      cssStd = cssImgLeft = cssImgRight = '';

      while ((tag = tags.pop())) {
        trailing = tags.length ? ',' : '';

        cssStd += '.cke_show_segments ' + tag + notDisabled + trailing + '{' +
          '}';
        cssImgLeft += '.cke_show_segments ' + tag + notDisabled + '::before{' +
          'content:url(' + CKEDITOR.getUrl(path + 'images/arrow-right-20.png') + ')' +
          '}';
        cssImgRight += '.cke_show_segments ' + tag + notDisabled + '::after{' +
          'content:url(' + CKEDITOR.getUrl(path + 'images/arrow-left-20.png') + ')' +
          '}';
      }

      CKEDITOR.addCss(cssStd.concat(cssImgLeft, cssImgRight));

      // [IE8] Reset the styles for non-editables and chosen elements, because
      // it could not be done using :not() pseudoclass.
      if (!supportsNotPseudoclass) {
        CKEDITOR.addCss(
          '.cke_show_segments [contenteditable=false],.cke_show_segments .cke_show_segments_off{' +
          'border:none;' +
          'padding-top:0;' +
          'background-image:none' +
          '}'
        );
      }
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
})();

/**
 * If we want to automatically enable the showsegments command when the editor loads.
 *
 *		config.startupOutlineBlocks = true;
 *
 * @cfg {Boolean} [startupOutlineBlocks=false]
 * @member CKEDITOR.config
 */
