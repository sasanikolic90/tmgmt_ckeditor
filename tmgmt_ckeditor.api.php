<?php

/**
 * @file
 * Hooks provided by the TMGMT CKEditor module.
 */

use Drupal\tmgmt\JobItemInterface;

/**
 * Allows to alter a text's segment unmasking the HTML tags from a tmgmt-tag.
 *
 * @param string $text
 *   The text's segment to alter.
 * @param array $data_item
 *   The data item.
 * @param \Drupal\tmgmt\JobItemInterface $job_item
 *   The job item context.
 */
function hook_tmgmt_data_item_text_output_alter(&$text, $data_item, JobItemInterface $job_item) {
  $text = str_replace('First', 'Second', $text);
}

/**
 * Allows to alter a text's segment masking the HTML tags into a tmgmt-tag.
 *
 * @param string $text
 *   The text's segment to alter.
 * @param array $data_item
 *   The data item.
 * @param \Drupal\tmgmt\JobItemInterface $job_item
 *   The job item context.
 */
function hook_tmgmt_data_item_text_input_alter(&$text, $data_item, JobItemInterface $job_item) {
  $text = str_replace('Second', 'First', $text);
}
