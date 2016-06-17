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
    $content = $request->query->get('segment');
    $json_segment = array();
    if (!empty($content)) {
      /**
       * @var \Drupal\tmgmt_memory\MemoryManager $memory_manager
       */
      $translated_segment = $memory_manager->getSegmentTranslation('en', $content, 'de');
      $json_segment = array("translatedSegment" => $translated_segment->getTarget()->getStrippedData());
    }
    return new JsonResponse($json_segment);
  }
}
