import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const productionPlaceholderPattern = /待填|拍攝後填|拍後填|核實名稱|實際時間|資料拍攝後|留到拍完/;

const expectedHuman = [
  "on_location_fact_sprint", "two_person_misunderstanding_twist", "situational_multi_dish_tasting",
  "route_led_city_portrait", "faceless_sensory_food_discovery", "problem_first_lifestyle_product",
  "host_led_food_culture_tasting", "human_product_demo_conversion", "seated_host_research_explainer",
  "first_person_journey_diary", "multi_stop_city_curation", "spectacle_first_experience_micro",
  "immersive_experience_reflection",
];
const expectedAi = [
  "ai_artist_reflective_monologue", "ai_cinematic_founder_biography", "ai_absurd_twist_microdrama",
  "ai_continuity_ensemble_skit", "ai_host_time_travel_tour",
];
const payload = JSON.parse(await readFile(new URL("../data/content-direction-demo-scripts.json", import.meta.url), "utf8"));
const scripts = payload.scripts;

assert.equal(payload.schema_version, 1);
assert.equal(scripts.length, 18, "expected exactly 18 independent demonstration scripts");
assert.equal(payload.scope.style_count, 18);
assert.equal(payload.scope.human_count, 13);
assert.equal(payload.scope.ai_count, 5);
assert.deepEqual(scripts.filter((script) => script.format === "human_short_video").map((script) => script.style_code), expectedHuman);
assert.deepEqual(scripts.filter((script) => script.format === "ai_short_video").map((script) => script.style_code), expectedAi);
assert.equal(new Set(scripts.map((script) => script.style_code)).size, 18, "style codes must be unique");
assert.equal(new Set(scripts.map((script) => script.script_title_zh)).size, 18, "script titles must be unique");
assert.equal(new Set(scripts.map((script) => script.timeline.map((beat) => beat.role).join(">"))).size, 18, "each style must have a distinct narrative role sequence");

for (const script of scripts) {
  assert.equal(script.status, "original_demonstration", `${script.style_code}: wrong status`);
  assert.ok(script.originality_notice_zh.length >= 12, `${script.style_code}: missing originality notice`);
  assert.equal(script.segment_count, script.timeline.length, `${script.style_code}: segment count mismatch`);
  assert.ok(script.timeline.length >= 5 && script.timeline.length <= 9, `${script.style_code}: implausible segment count`);
  assert.ok(script.duration_seconds >= 10 && script.duration_seconds <= 180, `${script.style_code}: implausible duration`);
  assert.equal(script.timeline[0].start_seconds, 0, `${script.style_code}: timeline must start at zero`);
  let cursor = 0;
  for (const beat of script.timeline) {
    assert.equal(beat.start_seconds, cursor, `${script.style_code}: non-contiguous timeline at beat ${beat.order}`);
    assert.ok(beat.end_seconds > beat.start_seconds, `${script.style_code}: non-positive beat duration`);
    assert.ok(beat.role && beat.visual_description_zh && beat.dialogue_or_narration_zh && beat.on_screen_text_zh, `${script.style_code}: incomplete beat ${beat.order}`);
    assert.ok(Array.isArray(beat.material_requirements) && beat.material_requirements.length, `${script.style_code}: beat ${beat.order} has no materials`);
    assert.doesNotMatch(`${beat.dialogue_or_narration_zh} ${beat.on_screen_text_zh}`, productionPlaceholderPattern, `${script.style_code}: production placeholder leaked into beat ${beat.order}`);
    const spokenCharacters = beat.dialogue_or_narration_zh.replace(/[\s，。；：、！？「」『』（）［］…,.!?—-]/g, "").length;
    assert.ok(spokenCharacters / (beat.end_seconds - beat.start_seconds) <= 5.5, `${script.style_code}: beat ${beat.order} is too dense to speak naturally`);
    if (script.format === "ai_short_video") assert.ok(beat.ai_prompt_zh?.length >= 20, `${script.style_code}: beat ${beat.order} has no usable AI prompt`);
    cursor = beat.end_seconds;
  }
  assert.equal(cursor, script.duration_seconds, `${script.style_code}: duration does not match timeline`);
  assert.ok(script.project_material_requirements.length, `${script.style_code}: missing project materials`);
  assert.ok(script.production_notes_zh.length >= 2, `${script.style_code}: production notes must be separate from spoken copy`);
  if (script.format === "ai_short_video") assert.ok(script.continuity_requirements.length >= 3, `${script.style_code}: missing continuity rules`);
  assert.deepEqual(script.generation, { enabled: false, runs: 0, paid_api_calls: 0, credits_used: 0 }, `${script.style_code}: generation must remain disabled`);
  const serialized = JSON.stringify(script);
  assert.ok(!serialized.includes("research_only"), `${script.style_code}: research-only material leaked into demo`);
  assert.ok(!serialized.includes("原片還原稿"), `${script.style_code}: restoration content leaked into demo`);
}

for (const code of ["situational_multi_dish_tasting", "faceless_sensory_food_discovery", "host_led_food_culture_tasting"]) {
  const script = scripts.find((entry) => entry.style_code === code);
  assert.match(JSON.stringify(script), /拍攝後|拍後/, `${code}: tasting claims must be recorded after filming`);
}
for (const code of ["on_location_fact_sprint", "route_led_city_portrait", "seated_host_research_explainer", "multi_stop_city_curation"]) {
  const script = scripts.find((entry) => entry.style_code === code);
  assert.ok(script.evidence_requirements.length, `${code}: evidence requirements missing`);
}

const factSprint = scripts.find((entry) => entry.style_code === "on_location_fact_sprint");
assert.match(JSON.stringify(factSprint.timeline), /一支已校準紅外線溫度計/, "fact sprint must use one consistent instrument");
assert.match(JSON.stringify(factSprint.timeline), /表面溫度 ≠ 氣溫 ≠ 人體舒適度/, "fact sprint must distinguish the measurement from thermal comfort");
const misunderstanding = scripts.find((entry) => entry.style_code === "two_person_misunderstanding_twist");
assert.doesNotMatch(JSON.stringify(misunderstanding.timeline), /第一件你負責洗/, "misunderstanding close must name a washable object");

console.log(`Verified ${scripts.length} independent demo scripts (${expectedHuman.length} human, ${expectedAi.length} AI) across ${scripts.reduce((sum, script) => sum + script.segment_count, 0)} contiguous timeline segments.`);
