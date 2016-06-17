<?php

/**
 * @file
 * Contains \Drupal\tmgmt_ckeditor\Controller\TMGMTCKEditorController.
 */

namespace Drupal\tmgmt_ckeditor\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

class TMGMTCKEditorController extends ControllerBase {

  /**
   * Callback for `tmgmt_ckeditor/get.json` API method.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   A configured text editor object
   * @return JsonResponse
   *   Returns data in a json.
   */
  public function get(Request $request) {
    $params = array();
    $content = $request->query->get('segment');
    if (!empty($content)) {
      /**
       * @var \Drupal\tmgmt_memory\MemoryManager $memory_manager
       */
      $memory_manager = \Drupal::service('tmgmt_memory.memory_manager');
      $first_segment_text = 'This is the first segment.';
      $second_segment_text = 'This is the second segment.';
      $third_segment_text = 'This is the third segment.';

      $first_segment_translated = 'This is the first translated segment';
      $second_segment_translated = 'This is the second translated segment';
      $third_segment_translated = 'This is the third translated segment';

      $memory_manager->addSegment('en', $first_segment_text);
      $memory_manager->addSegment('en', $second_segment_text);
      $memory_manager->addSegment('en', $third_segment_text);

      $memory_manager->addSegmentTranslation('en', $first_segment_text, 'de', $first_segment_translated);
      $memory_manager->addSegmentTranslation('en', $second_segment_text, 'de', $second_segment_translated);
      $memory_manager->addSegmentTranslation('en', $third_segment_text, 'de', $third_segment_translated);
      $translated_segment = $memory_manager->getSegmentTranslation('en', $content, 'de');

      $json_segment = array("translatedSegment" => $translated_segment->getTarget()->getStrippedData());
    }
    return new JsonResponse($json_segment);
  }
}
