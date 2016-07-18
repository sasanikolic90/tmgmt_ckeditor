<?php

namespace Drupal\tmgmt_ckeditor\Tests;

use Drupal\file\Entity\File;
use Drupal\filter\Entity\FilterFormat;
use Drupal\tmgmt\Entity\JobItem;
use Drupal\tmgmt\Tests\EntityTestBase;

/**
 * Verifies the UI of the review form.
 *
 * @group tmgmt_ckeditor
 */
class TMGMTCKEditorHtmlTagTest extends EntityTestBase {

  public static $modules = [
    'tmgmt_ckeditor',
    'ckeditor',
    'tmgmt_content',
    'image',
    'node',
  ];

  /**
   * {@inheritdoc}
   */
  function setUp() {
    parent::setUp();

    $filtered_html_format = FilterFormat::create([
      'format' => 'filtered_html',
      'name' => 'Filtered HTML',
    ]);
    $filtered_html_format->save();

    $this->drupalCreateContentType(['type' => 'test_bundle']);

    $this->loginAsAdmin([
      'create translation jobs',
      'submit translation jobs',
      'create test_bundle content',
      'access content overview',
      'bypass node access',
      $filtered_html_format->getPermissionName(),
    ]);

    file_unmanaged_copy(DRUPAL_ROOT . '/core/misc/druplicon.png', 'public://example.jpg');
    $this->image = File::create([
      'uri' => 'public://example.jpg',
    ]);
    $this->image->save();
  }

  /**
   * Tests of the job item review process.
   */
  public function testReviewForm() {
    // Load the translatable_node segment node.
    $node = $this->drupalGetNodeByTitle('Segments test');
    $this->drupalGet('node/' . $node->id());

    // Node text values.
    $title = 'Segments test';

    $unmasked_body = '<tmgmt-segment id="1">This is the first segment.</tmgmt-segment><br />';
    $unmasked_body .= '<tmgmt-segment id="2">This is the second segment with single closing tags. <br /> <hr /></tmgmt-segment><br />';
    $unmasked_body .= '<tmgmt-segment id="3">This is the third segment. <b>This is a testing text inside a tag. The tag is properly closed.</b></tmgmt-segment><br />';
    $unmasked_body .= '<tmgmt-segment id="4">This is the fourth segment. <b>This is a testing text inside a tag. The tag is not properly closed.</tmgmt-segment><br />';
    $unmasked_body .= '<tmgmt-segment id="5">This is the fifth segment. <img src="path" alt="test" title="This is a testing text inside an image tag with attributes" /></tmgmt-segment>';

    $masked_body = '<tmgmt-segment id="1">This is the first segment.</tmgmt-segment><tmgmt-tag element="br" raw="&lt;br /&gt;" />';
    $masked_body .= '<tmgmt-segment id="2">This is the second segment with single closing tags. <tmgmt-tag element="br" raw="&lt;br /&gt;" /> <tmgmt-tag element="hr" raw="&lt;hr /&gt;" /></tmgmt-segment><tmgmt-tag element="br" raw="&lt;br /&gt;" />';
    $masked_body .= '<tmgmt-segment id="3">This is the third segment. <tmgmt-tag element="b" raw="&lt;b&gt;">This is a testing text inside a tag. The tag is properly closed.<tmgmt-tag element="/b" raw="&lt;/b&gt;"></tmgmt-segment><tmgmt-tag element="br" raw="&lt;br /&gt;" />';
    $masked_body .= '<tmgmt-segment id="4">This is the fourth segment. <tmgmt-tag element="b" raw="&lt;b&gt;">This is a testing text inside a tag. The tag is not properly closed.</tmgmt-segment><tmgmt-tag element="br" raw="&lt;br /&gt;" />';
    $masked_body .= '<tmgmt-segment id="5">This is the fifth segment. <tmgmt-tag element="img" raw="&lt;img src=&quot;path&quot; alt=&quot;test&quot; title=&quot;This is a testing text inside an image tag with attributes&quot; /&gt;" /></tmgmt-segment>';

    // Translation text values.
    $title_translated = $title . ' translation';

    // Create a Job with the node.
    $job = tmgmt_job_create('en', 'de');
    $job->translator = 'test_translator';
    $job->save();
    $job_item = tmgmt_job_item_create('content', 'node', $node->id(), ['tjid' => $job->id()]);
    $job_item->save();

    // Access to the review form.
    $this->drupalGet('admin/tmgmt/items/'. $job_item->id());
    // Check that 'hook_tmgmt_data_item_text_output_alter' has been called.
    $data = $job_item->getData();
    $this->assertEqual($data['title'][0]['value']['#text'], $title);
    $this->assertFieldByName('title|0|value[source]', $title);
    // Check the raw value in 'body|0|value[source][value]'.
    $this->assertRaw(htmlspecialchars($masked_body));

    // Check 'hook_tmgmt_data_item_text_input_alter' has been called on saving.
    $edit = [
      'title|0|value[translation]' => $title_translated,
      'body|0|value[translation][value]' => $masked_body,
    ];
    $this->drupalPostForm(NULL, $edit, 'Save');
    // Clean the storage and get the updated job item data.
    \Drupal::entityTypeManager()->getStorage('tmgmt_job_item')->resetCache();
    $job_item = JobItem::load($job_item->id());
    $data = $job_item->getData();
    $this->assertEqual($data['title'][0]['value']['#text'], $title);
    $this->assertEqual($data['body'][0]['value']['#text'], $unmasked_body);
    $this->assertEqual($data['title'][0]['value']['#translation']['#text'], $title_translated);
    $this->assertEqual($data['body'][0]['value']['#translation']['#text'], $unmasked_body);

    // Check that 'hook_tmgmt_data_item_text_output_alter' has been called.
    $this->drupalGet('admin/tmgmt/items/'. $job_item->id());
    $this->assertFieldByName('title|0|value[source]', $title);
    // Check the raw value in 'body|0|value[source][value]'.
    $this->assertRaw(htmlspecialchars($masked_body));
    $this->assertFieldByName('title|0|value[translation]', $title_translated);
    // Check the raw value in 'body|0|value[translation][value]'.
    $this->assertRaw(htmlspecialchars($masked_body));
  }

}
