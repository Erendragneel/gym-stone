(function (root, factory) {
  'use strict';
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  if (root) root.GymMachineData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Explicit catalog IDs keep a detected machine from suggesting unrelated
  // exercises that happen to share a muscle group or the generic "Machine" tag.
  function category(id, name, description, exerciseIds, note) {
    return Object.freeze({ id, name, description, exerciseIds: Object.freeze(exerciseIds), note });
  }

  const categories = Object.freeze([
    category('cable-station', 'Adjustable cable station', 'an adjustable pulley cable weight-stack functional trainer', [
      'g0-09_Cable_Hip_Abduction', 'g0-10_Cable_Glute_Kickback',
      'g1-15_Single_Arm_Cable_Pulldown', 'g1-16_Straight_Arm_Cable_Pulldown', 'g1-24_Rope_Face_Pull',
      'g2-10_Cable_Lateral_Raise', 'g2-14_Cable_Front_Raise', 'g2-24_Cable_External_Rotation',
      'g3-17_Standing_Cable_Curl', 'g3-18_Single_Arm_Cable_Curl', 'g3-19_Rope_Hammer_Cable_Curl',
      'g3-20_Bayesian_Cable_Curl', 'g3-21_Overhead_Cable_Curl',
      'g4-15_High_to_Low_Cable_Woodchop', 'g4-16_Low_to_High_Cable_Woodchop',
      'g4-17_Horizontal_Cable_Rotation', 'g4-18_Pallof_Press', 'guide-cable-triceps-pushdown',
      'exp-standing-cable-chest-press', 'exp-single-arm-cable-chest-press', 'exp-standing-cable-chest-fly',
      'exp-low-to-high-cable-chest-fly', 'exp-high-to-low-cable-chest-fly', 'exp-supine-cable-chest-fly',
      'exp-seated-cable-chest-press', 'exp-seated-cable-overhead-triceps-extension',
      'exp-single-arm-cable-triceps-pressdown', 'exp-cable-triceps-kickback',
      'exp-lying-cable-triceps-extension', 'exp-cross-body-cable-triceps-extension',
      'exp-standing-single-arm-cable-row', 'exp-bent-over-cable-row', 'exp-standing-high-cable-row',
      'exp-supine-cable-pullover', 'exp-cable-shrug', 'exp-single-arm-seated-cable-shoulder-press',
      'exp-cable-scaption-raise', 'exp-cable-y-raise', 'exp-cable-rear-delt-fly',
      'exp-cable-internal-rotation', 'exp-cable-preacher-curl', 'exp-reverse-cable-curl',
      'exp-cable-drag-curl', 'exp-cable-split-squat', 'exp-standing-cable-leg-extension',
      'exp-cable-pull-through', 'exp-standing-cable-leg-curl', 'exp-cable-hip-adduction',
      'exp-cable-reverse-lunge', 'exp-kneeling-cable-crunch', 'exp-side-plank-cable-row'
    ], 'Choose a move only when the pulley position and attachment match. Leg moves need an ankle cuff; some moves need a rope, bar, bench or preacher support. Two-handle presses, flies and curls require two usable cables. A fixed lat-pulldown or seated-row station has its own category.'),
    category('chest-press', 'Chest press machine', 'a seated chest press machine with forward pressing handles', [
      'exp-machine-chest-press'
    ], 'Use the seated chest press setup. Choose the incline category if the machine presses upward on an incline.'),
    category('incline-chest-press', 'Incline chest press machine', 'an incline chest press machine with an angled backrest and upward pressing handles', [
      'exp-incline-machine-chest-press'
    ], 'Confirm that this is the incline press version and adjust the seat to its handles.'),
    category('pec-deck', 'Pec deck chest fly', 'a seated pec deck chest fly machine with arm pads or wide handles', [
      'exp-pec-deck-chest-fly'
    ], 'Choose the chest fly position. A reverse fly is available only on machines that support that separate setup.'),
    category('reverse-pec-deck', 'Reverse pec deck / rear delt fly', 'a reverse pec deck rear delt machine used while facing the chest pad', [
      'g2-17_Reverse_Pec_Deck'
    ], 'Confirm that the machine supports reverse flies and use its rear delt setup.'),
    category('shoulder-press', 'Shoulder press machine', 'a seated shoulder press machine with overhead pressing handles', [
      'g2-06_Machine_Shoulder_Press'
    ], 'Confirm overhead pressing handles rather than a forward chest press.'),
    category('lateral-raise', 'Lateral raise machine', 'a seated lateral raise machine with pads beside the upper arms', [
      'exp-machine-lateral-raise'
    ], 'Use the machine with upper-arm pads for raising the arms sideways.'),
    category('chest-supported-row', 'Chest-supported row machine', 'a seated chest-supported rowing strength machine with pulling handles', [
      'g1-10_Chest_Supported_Machine_Row'
    ], 'This category is for a supported strength row, not a rowing ergometer or a high-row machine.'),
    category('high-row', 'High row machine', 'a seated high row strength machine with handles above the shoulders', [
      'g1-21_Machine_High_Row'
    ], 'Confirm the high-row lever path. A seated low cable row uses another category.'),
    category('seated-cable-row', 'Seated cable row station', 'a seated low cable row station with a bench and footplates', [
      'g1-11_Neutral_Grip_Seated_Cable_Row', 'g1-12_Wide_Grip_Seated_Cable_Row'
    ], 'Choose the grip that matches the available row handle; this fixed station does not imply other cable setups.'),
    category('lat-pulldown', 'Lat pulldown station', 'a seated lat pulldown weight-stack machine with an overhead bar and thigh pads', [
      'g1-13_Wide_Grip_Lat_Pulldown', 'g1-14_Close_Neutral_Grip_Pulldown'
    ], 'Use a suitable pulldown bar or close neutral-grip handle and secure the thigh pad.'),
    category('plate-loaded-lat-pulldown', 'Plate-loaded lat pulldown', 'a plate-loaded lat pulldown lever machine with overhead handles', [
      'exp-plate-loaded-lat-pulldown'
    ], 'Choose this category for the plate-loaded lever version rather than an adjustable cable tower.'),
    category('pullover', 'Pullover machine', 'a seated pullover machine with an overhead lever and elbow pads', [
      'exp-machine-pullover'
    ], 'Confirm the supported pullover lever; a lat-pulldown station is a different machine.'),
    category('preacher-curl', 'Biceps / preacher curl machine', 'a seated biceps preacher curl machine with an arm support pad and handles', [
      'g3-22_Machine_Preacher_Curl'
    ], 'This is a curl machine with resistance built in. A preacher bench alone also needs a dumbbell or an EZ bar.'),
    category('triceps-extension', 'Triceps extension machine', 'a seated triceps extension machine with upper-arm support and push handles', [
      'exp-machine-triceps-extension'
    ], 'Confirm the triceps extension lever setup rather than a cable pressdown or dip station.'),
    category('assisted-pull-up-dip', 'Assisted pull-up / dip station', 'an assisted pull-up and dip machine with a moving knee pad and overhead grips', [
      'exp-machine-assisted-pull-up', 'exp-assisted-triceps-dip'
    ], 'Choose only the mode your station supports: overhead grips for pull-ups or side handles for dips. The selected weight is assistance.'),
    category('leg-extension', 'Leg extension machine', 'a seated leg extension machine with a roller in front of the shins', [
      'guide-leg-extension', 'exp-single-leg-leg-extension'
    ], 'Confirm the leg extension mode. Use the single-leg version only if the machine permits it; leg curls are a different movement.'),
    category('seated-leg-curl', 'Seated leg curl machine', 'a seated leg curl machine with a thigh restraint and ankle roller', [
      'exp-seated-leg-curl', 'exp-single-leg-seated-leg-curl'
    ], 'Choose the seated curl setup and its supported one-leg or two-leg version.'),
    category('prone-leg-curl', 'Lying leg curl machine', 'a lying prone leg curl machine with a face-down bench and ankle roller', [
      'guide-prone-leg-curl', 'exp-single-leg-prone-leg-curl'
    ], 'Use the face-down curl setup. Select one-leg curls only when supported by the machine.'),
    category('standing-leg-curl', 'Standing leg curl machine', 'a standing leg curl machine with a support pad and ankle roller', [
      'exp-standing-leg-curl-machine'
    ], 'Confirm that the machine is designed for standing leg curls.'),
    category('kneeling-leg-curl', 'Kneeling leg curl machine', 'a kneeling leg curl machine with chest support and a knee platform', [
      'exp-kneeling-leg-curl-machine'
    ], 'Use the kneeling setup shown on the machine rather than seated or lying curl instructions.'),
    category('hip-abduction-adduction', 'Hip abduction / adduction machine', 'a seated hip abduction or adduction machine with pads beside the knees', [
      'g0-21_Hip_Abduction_Machine', 'g0-22_Hip_Adduction_Machine'
    ], 'These machines can look alike. Read the label: abduction pushes the legs apart; adduction brings them together. Choose only the mode your machine supports.'),
    category('leg-press', 'Leg press machine', 'a leg press machine with a seat and a large footplate', [
      'exp-45-degree-leg-press', 'exp-horizontal-leg-press', 'exp-single-leg-leg-press', 'exp-leg-press-calf-raise'
    ], 'Choose the 45-degree or horizontal version that matches the machine. Single-leg presses and calf raises are options only if the machine instructions support that setup.'),
    category('hack-squat', 'Hack squat machine', 'a hack squat machine with shoulder pads and a back-supported sliding sled', [
      'exp-hack-squat-machine'
    ], 'Confirm that the sled supports a standing hack squat; a seated leg press uses another category.'),
    category('belt-squat', 'Belt squat machine', 'a belt squat machine with a standing platform and a hip belt attachment', [
      'exp-belt-squat'
    ], 'Use the machine with its intended hip belt and platform.'),
    category('smith-machine', 'Smith machine', 'a Smith machine with a barbell fixed on vertical guide rails', [
      'exp-smith-machine-squat', 'exp-smith-machine-hip-thrust',
      'exp-smith-machine-seated-calf-raise', 'exp-smith-machine-standing-calf-raise'
    ], 'Choose a Smith-specific move and set the catches. Hip thrusts and seated calf raises also require the appropriate stable bench or seat.'),
    category('hip-thrust', 'Hip thrust machine', 'a hip thrust machine with a padded hip belt or lever and a back support', [
      'exp-hip-thrust-machine'
    ], 'Confirm a dedicated hip thrust setup rather than a seated leg press.'),
    category('reverse-hyperextension', 'Reverse hyperextension machine', 'a reverse hyperextension machine with a high torso platform and a hanging leg pendulum', [
      'exp-reverse-hyperextension-machine'
    ], 'This machine moves the legs beneath a supported torso; a back extension bench moves the torso instead.'),
    category('standing-hip-extension', 'Standing hip extension machine', 'a standing hip extension machine with a hip-height leg resistance pad', [
      'exp-standing-hip-extension-machine'
    ], 'Choose only a machine configured for standing hip extension; a multi-hip machine may have other modes.'),
    category('seated-calf-raise', 'Seated calf raise machine', 'a seated calf raise machine with a thigh pad and a raised forefoot platform', [
      'exp-seated-calf-raise-machine'
    ], 'Confirm the seated calf machine and secure its thigh pad.'),
    category('standing-calf-raise', 'Standing calf raise machine', 'a standing calf raise machine with shoulder pads above a foot platform', [
      'exp-standing-calf-raise-machine'
    ], 'This category is for a dedicated standing calf machine rather than a Smith machine.'),
    category('donkey-calf-raise', 'Donkey calf raise machine', 'a donkey calf raise machine with a bent-over torso support and a hip pad', [
      'exp-donkey-calf-raise-machine'
    ], 'Confirm the bent-over donkey calf raise setup.'),
    category('glute-ham-developer', 'Glute-ham developer', 'a glute-ham developer with rounded thigh pads and an ankle restraint', [
      'exp-glute-ham-raise'
    ], 'Use the glute-ham raise setup with feet secured. It is different from a reverse hyperextension machine.'),
    category('back-extension-bench', '45-degree back extension bench', 'a 45-degree back extension Roman chair with hip pads and ankle supports', [
      'g1-04_45_Degree_Back_Extension'
    ], 'Confirm the 45-degree bench and adjust the hip pads and foot supports.'),
    category('nordic-bench', 'Nordic curl bench', 'a Nordic hamstring curl bench with a knee pad and ankle restraint', [
      'exp-assisted-nordic-hamstring-curl'
    ], 'Secure the intended ankle restraint and use the assisted version in the library.'),
    category('pull-up-bar', 'Pull-up bar', 'a gym pull-up bar mounted overhead for hanging exercises', [
      'g1-17_Overhand_Pull_Up', 'g1-18_Wide_Grip_Pull_Up', 'g1-19_Neutral_Grip_Pull_Up',
      'g3-24_Chin_Up', 'g4-21_Hanging_Oblique_Knee_Raise', 'g4-22_Hanging_Windshield_Wipers',
      'g4-23_Hanging_Knee_Raise_With_Twist', 'exp-scapular-pull-up',
      'exp-hanging-straight-leg-raise', 'exp-dead-hang'
    ], 'Choose a grip the bar actually provides; neutral-grip pull-ups require parallel handles.'),
    category('parallel-bars', 'Parallel dip bars', 'a parallel bar dip station with two waist-high handles', [
      'exp-parallel-bar-triceps-dip'
    ], 'Confirm stable parallel dip handles. A bench dip or an assisted dip machine has a different setup.'),
    category('captains-chair', "Captain's chair / knee raise station", 'a vertical knee raise captains chair with forearm pads and back support', [
      'exp-captains-chair-knee-raise'
    ], 'Use the forearm and back supports for the knee raise version.'),
    category('landmine', 'Landmine barbell station', 'a landmine barbell anchored at one end near the floor', [
      'g1-07_T_Bar_Row', 'g2-07_Half_Kneeling_Landmine_Press', 'g2-08_Two_Hand_Landmine_Press',
      'g4-19_Landmine_Rotation', 'exp-landmine-squat'
    ], 'Confirm an anchored barbell. The T-bar row needs the matching row handle; other moves use the bar end.'),
    category('treadmill', 'Treadmill', 'a gym treadmill with a running belt and handrails', [
      'exp-treadmill-jog'
    ], 'Choose the treadmill activity and enter your actual time.'),
    category('elliptical', 'Elliptical trainer', 'an elliptical cardio trainer with long pedals and moving handles', [
      'exp-elliptical-trainer'
    ], 'Choose the elliptical activity rather than a stair climber or exercise bike.'),
    category('rowing-ergometer', 'Rowing machine / ergometer', 'an indoor cardio rowing machine', [
      'exp-rowing-machine'
    ], 'This is the cardio rower with a sliding seat, not a seated strength row machine.'),
    category('air-bike', 'Air / fan bike', 'an air resistance exercise bike with a large front fan and moving handles', [
      'exp-air-bike'
    ], 'Choose this category for a fan bike with moving handles; a regular stationary bicycle uses another category.'),
    category('stationary-bike', 'Upright stationary bike', 'an upright stationary exercise bicycle with fixed handlebars', [],
      'The general library has no upright cycling entry. Use Log activity for cycling; pregnancy-only activities are not suggested by this lookup.'),
    category('stair-climber', 'Stair climber', 'a stair climbing cardio machine with revolving steps', [
      'exp-stair-climber'
    ], 'Choose the stair-climbing activity and enter your actual time.'),
    category('sled', 'Push / drag sled', 'a weighted gym sled with upright push handles on the floor', [
      'exp-sled-push', 'exp-backward-sled-drag'
    ], 'Choose a push only if the sled has push handles. A backward drag also requires the intended straps and a suitable training area.'),
    category('exercise-bench', 'Stable exercise bench', 'a flat padded exercise bench in a gym', [
      'g0-16_Bulgarian_Split_Squat', 'g4-24_Copenhagen_Plank', 'guide-bench-dip',
      'exp-incline-push-up', 'exp-decline-push-up', 'exp-bench-bodyweight-triceps-extension',
      'exp-front-foot-elevated-split-squat', 'exp-single-leg-box-squat',
      'exp-bodyweight-bench-hip-thrust', 'exp-single-leg-hip-thrust',
      'exp-feet-elevated-glute-bridge', 'exp-single-leg-feet-elevated-glute-bridge',
      'exp-bodyweight-bulgarian-split-squat'
    ], 'Use a stable bench with a height suitable for the chosen move. A bench alone does not establish access to dumbbells, a barbell rack or a safe step-up platform.')
  ]);

  const byId = new Map(categories.map(item => [item.id, item]));
  const exerciseIdsByCategory = new Map(categories.map(item => [item.id, new Set(item.exerciseIds)]));
  const negativeCandidates = Object.freeze([
    Object.freeze({ id: 'not-gym', text: 'a photo of a household object that is not gym equipment' }),
    Object.freeze({ id: 'multiple-machines', text: 'a wide photo of a gym room with many different exercise machines' }),
    Object.freeze({ id: 'food', text: 'a photo of food or a meal' }),
    Object.freeze({ id: 'outdoor', text: 'an outdoor scene with a street trees or a landscape' }),
    Object.freeze({ id: 'animal', text: 'a photo of a cat dog or another animal' }),
    Object.freeze({ id: 'person', text: 'a portrait or selfie of a person without exercise equipment' })
  ]);

  function get(id) { return byId.get(id) || null; }
  function matches(exercise, id) {
    if (id === '' || id == null) return true;
    const allowed = exerciseIdsByCategory.get(id);
    if (!allowed || !exercise || exercise.prenatal) return false;
    return allowed.has(typeof exercise === 'string' ? exercise : exercise.id);
  }
  function candidates() {
    return categories.map(item => ({ id: item.id, text: 'a photo of ' + item.description }))
      .concat(negativeCandidates.map(item => ({ id: item.id, text: item.text })));
  }

  return Object.freeze({ categories, get, matches, candidates });
});
