# tmgmt_ckeditor
CKEditor plugins for TMGMT - Drupal 8.

This is my project for Google Summer of Code 2016. The plan is to create two CKEditor plugins for Translation Management Tool module. 

One would convert text parts into segments to easily segment the content into smaller bits and enable easier translation management. It's connected with Translation Memory (https://www.drupal.org/sandbox/edurenye/2715815), to provide saved translation suggestion for requested segments.

The second plugin is to mask HTML tags inside segments. This would help is to understand the structure better and cleanly show which opening/closing tags are missing inside a segment.

This module currently depends on three other modules. Before installing, make sure you have these modules downloaded:
- Translation Management Tool
- Paragraphs
- Translation Memory (found here: https://www.drupal.org/sandbox/edurenye/2715815)

To enable the display segments, do the following:
- Enable tmgmt_ckeditor module (this enables tmgmt_demo and paragraphs_demo for testing)
- It automatically adds a new HTML format
- Translate a translatable node or a paragraphed article
- You can see the work done on the translate and review page
