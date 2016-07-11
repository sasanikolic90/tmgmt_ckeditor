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

    // Create a Job with the node.
    $job = tmgmt_job_create('en', 'de');
    $job->translator = 'test_translator';
    $job->save();
    $job_item = tmgmt_job_item_create('content', 'node', $node->id(), ['tjid' => $job->id()]);
    $job_item->save();

    // Access to the review form.
    $this->drupalGet('admin/tmgmt/items/'. $job_item->id());
    // Check that 'hook_tmgmt_data_item_text_output_alter' has been called.
    $data_item = $job_item->getData();
    $this->assertEqual($data_item['title'][0]['value']['#text'], 'Segments test');
    $this->assertFieldByName('title|0|value[source]', 'Segments test');

    // Check 'hook_tmgmt_data_item_text_input_alter' has been called on saving.
    $this->drupalPostForm(NULL, ['title|0|value[translation]' => 'Second node translation'], 'Save');
    // Clean the storage and get the updated job item data.
    \Drupal::entityTypeManager()->getStorage('tmgmt_job_item')->resetCache();
    $job_item = JobItem::load($job_item->id());
    $data = $job_item->getData();
    $this->assertEqual($data_item['title'][0]['value']['#text'], 'First node');
    $this->assertEqual($data['title'][0]['value']['#translation']['#text'], 'First node translation');

    // Access to the review form.
    $this->drupalGet('admin/tmgmt/items/'. $job_item->id());
    // Check that 'hook_tmgmt_data_item_text_output_alter' has been called.
    $this->assertFieldByName('title|0|value[source]', 'Second node');
    $this->assertFieldByName('title|0|value[translation]', 'Second node translation');
  }

}
