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

    exec: function (editor) {
      this.toggleState();
      this.refresh(editor);
      var relatedEditor = getRelatedEditor(editor);
      relatedEditor.commands.showtags.toggleState();
    },

    refresh: function(editor) {
      if (editor.document) {
        // showSegments turns inactive after editor loses focus when in inline.
        var showTags = (this.state === CKEDITOR.TRISTATE_ON && (editor.elementMode !== CKEDITOR.ELEMENT_MODE_INLINE || editor.focusManager.hasFocus));

        var funcName = showTags ? 'attachClass' : 'removeClass';
        editor.editable()[funcName]('cke_show_tags');

        // Display tags also in the related editor.
        var relatedEditor = getRelatedEditor(editor);
        relatedEditor.editable()[funcName]('cke_show_tags');
      }
    }
  };

  CKEDITOR.plugins.add('tmgmt_tags', {
    lang: 'en',
    icons: 'showtags',
    hidpi: true,
    requires: 'tmgmt_segments',

    // Display tags in the editor.
    onLoad: function () {
      var openingTag;
      var element;
      var tags;
      // Loop over editor instances.
      for (var i in CKEDITOR.instances) {
        if (CKEDITOR.instances.hasOwnProperty(i)) {
          // Search only in source editors.
          var sourceEditor = CKEDITOR.instances[i].name.match(/.*value-source-value$/);
          if (sourceEditor) {
            // If tags with elements are found, add the css to display the tags before.
            var regex = new RegExp(/element=\"(\w+?)\"/g);
            tags = _.uniq(CKEDITOR.instances[i].getData().match(regex));
            for (var j in tags) {
              if (tags.hasOwnProperty(j)) {
                var parts = regex.exec(tags[j]); // Run regex exec.
                regex.lastIndex = 0; // Reset the last index of regex (null issue).
                element = '[' + parts[0] + ']';
                openingTag = '';
                openingTag += '.cke_show_tags ' + tag + element + '::before{' +
                  'content:' + '"' + parts[1] + '"' +
                  '}';
                CKEDITOR.addCss(openingTag);
              }
            }
          }
        }
      }
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
      editor.on('contentDom', function () {
        if (command.state !== CKEDITOR.TRISTATE_DISABLED) {
          command.refresh(editor);
        }
      });

      // Refresh the command on setData.
      editor.on('instanceReady', function () {
        CKEDITOR.dtd.$empty['tmgmt-tag'] = 1;
      });

      function onFocusBlur() {
        command.refresh(editor);
      }
    }
  });

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
