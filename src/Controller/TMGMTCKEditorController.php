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
    $strippedContent = $request->query->get('segmentStrippedText');
    $fullContent = $request->query->get('segmentHtmlText');
    $unmasked_html = tmgmt_ckeditor_html_unmask($fullContent);
    $sourceLanguage = $request->query->get('lang_source');
    $targetLanguage = $request->query->get('lang_target');
    $json_segment = array();
    if (!empty($fullContent)) {
      /**
       * @var \Drupal\tmgmt_memory\MemoryManager $memory_manager
       */
      $memory_manager = \Drupal::service('tmgmt_memory.memory_manager');
      $translated_segments = $memory_manager->getUsageTranslations($sourceLanguage, $unmasked_html, $targetLanguage);
      if ($translated_segments) {
        foreach($translated_segments as $key => $segment) {
          $json_segment[]  = array(
            "trSegmentHtmlText" => tmgmt_ckeditor_html_mask($segment->getTarget()->getData()),
            "trSegmentStrippedText" => strip_tags($segment->getTarget()->getData()),
            'quality' => $segment->getQuality(),
            'sourceSegmentId' => $segment->getSource()->getSegmentDelta(),
            'targetSegmentId' => $segment->getTarget()->getSegmentDelta(),
          );
        }
      }
      else {
        return new JsonResponse(null, 204);
      }
    }
    return new JsonResponse($json_segment);
  }
}
