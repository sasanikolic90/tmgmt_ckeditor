# tmgmt_ckeditor
CKEditor plugins for TMGMT - Drupal 8.

This module contains code for my Google Summer of Code 2016 project. The plan is to create two CKEditor plugins for [Translation Management Tool module](https://www.drupal.org/project/tmgmt).

One would convert text parts into segments to easily segment the content into smaller bits and enable easier translation management. It's connected with the [Translation Memory](https://www.drupal.org/sandbox/edurenye/2715815), to provide saved translation suggestions for requested segments.

The second plugin is to mask HTML tags inside segments. This would help us to understand the structure better and cleanly show which opening/closing tags are missing inside a segment.

NOTE: This project provides a number of puzzle pieces towards providing translators and reviewers better tools to work with TMGMT. Many other things are needed until this fully works together with real content.

## Development workflow

The development workflow can be seen in my GitHub repository - by clicking [here](https://github.com/sasanikolic90/tmgmt_ckeditor/network). This shows all the branches that got created. Some of them got merged, others were created just for testing purposes.

All the commits for the main branch are listed [here](https://github.com/sasanikolic90/tmgmt_ckeditor/commits/8.x-1.x).

## Dependencies 

For testing purposes, it currently depends on three other modules. Before installing, make sure you have these modules downloaded:

- Translation Management Tool
- Paragraphs
- Translation Memory (found [here](https://www.drupal.org/sandbox/edurenye/2715815))

## How to test it:

- make sure you have all the dependencies
- install the module
- for now, only the predefined nodes from my module are working - "Test for CKEditor plugins" and "Test for CKEditor plugins with paragraphs"
- request a (german) translation of either one of those two nodes
- enable plugins on translate/review page in the editor toolbar
- test it (and possibly send me some feedback)

## What works:

- dummy nodes for testing with new text format
- works on nodes with one or more editor pairs (paragraphs)
- masking and unmasking the HTML tags
- displaying the active segment in both editors
- translation memory querying
- displaying suggested translations from the memory
- using suggested translations - placing the selected one in the active editor
- validation of missing tags (globally and per segment)
- adding of missing tag
- set segments as completed
- masked tag dragging

## What needs work:

- warning messages: ```Warning: DOMNode::cloneNode(): ID x already defined``` (in tmgmt_memory)
- text segmentation (in tmgmt_memory)
- saving segmented content properly, so that accepting translation does not save segments but initial content
- responsiveness
- toggling Source in the editor adds ```<p>nbsp;</p>```

I have created some issues on for my sandbox project on drupal.org, which can be seen [here](https://www.drupal.org/project/issues/2737249?categories=All).

## Future steps:

- marking a specific word
- get definitions and synonyms for the word
- UI improvements
- testing
- real users feedback

Also note that some of the "what needs work" and “not-working” issues listed above are not on my side; either they are out of scope for my GSoC project or based on tmgmt_memory/TMGMT.

When altogether will be fully functional, this module will be merged into TMGMT.

## Code

The project can be found in my [sandbox](https://www.drupal.org/sandbox/sasanikolic/2737249) on drupal.org and in my [GitHub repository](https://github.com/sasanikolic90/tmgmt_ckeditor). Both project will stay updated. The current main branch is 8.x-1.x. 
