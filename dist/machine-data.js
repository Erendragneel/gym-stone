(function (root, factory) {
  'use strict';
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  if (root) root.GymMachineData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Explicit catalog IDs keep a detected machine from suggesting unrelated
  // exercises that happen to share a muscle group or the generic "Machine" tag.
  function category(id, name, description, exerciseIds, note, referenceOnly = false) {
    return Object.freeze({ id, name, description, exerciseIds: Object.freeze(exerciseIds), note, referenceOnly });
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
    category('decline-chest-press', 'Decline chest press machine', 'a decline chest press machine with a supported seat and downward pressing handles', [
      'gym-floor-decline-machine-chest-press'
    ], 'Use the dedicated decline machine setup and its intended handles.'),
    category('standing-chest-press', 'Standing chest press machine', 'a standing chest press lever machine with forward pressing handles', [
      'gym-floor-standing-machine-chest-press'
    ], 'Use a dedicated standing press machine. A standing cable press uses a different station.'),
    category('incline-machine-fly', 'Incline chest fly machine', 'an incline chest fly machine with an angled torso support and moving fly handles', [
      'gym-floor-incline-machine-chest-fly'
    ], 'Confirm the inclined machine fly setup rather than an incline dumbbell fly or a standard pec deck.'),
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
    category('single-leg-leg-extension', 'Single-leg leg extension machine', 'a leg extension machine configured for one leg at a time with a shin roller', [
      'exp-single-leg-leg-extension'
    ], 'Use the machine’s intended single-leg setup and repeat with the other leg.'),
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
    category('standing-hip-abduction', 'Standing hip abduction machine', 'a standing hip abductor machine with foot platforms, thigh pads, and upright support handles', [
      'gym-floor-standing-machine-hip-abduction'
    ], 'Use the standing machine guide and the supports provided by the actual station.'),
    category('leg-press', 'Leg press machine', 'a leg press machine with a seat and a large footplate', [
      'exp-45-degree-leg-press', 'exp-horizontal-leg-press', 'exp-single-leg-leg-press', 'exp-leg-press-calf-raise'
    ], 'Choose the 45-degree or horizontal version that matches the machine. Single-leg presses and calf raises are options only if the machine instructions support that setup.'),
    category('hack-squat', 'Hack squat machine', 'a hack squat machine with shoulder pads and a back-supported sliding sled', [
      'exp-hack-squat-machine'
    ], 'Confirm that the sled supports a standing hack squat; a seated leg press uses another category.'),
    category('belt-squat', 'Belt squat machine', 'a belt squat machine with a standing platform and a hip belt attachment', [
      'exp-belt-squat'
    ], 'Use the machine with its intended hip belt and platform.'),
    category('pendulum-squat', 'Pendulum squat machine', 'a pendulum squat machine with shoulder pads and a pivoting squat arm above an angled footplate', [
      'gym-floor-pendulum-squat'
    ], 'Use the pendulum machine setup and release/re-engage its intended start support.'),
    category('v-squat', 'V-squat machine', 'a V-squat machine with shoulder supports on a pivoting lever and a standing foot platform', [
      'gym-floor-v-squat'
    ], 'Follow the orientation marked on the V-squat machine. A hack squat sled has a different path.'),
    category('smith-machine', 'Smith machine', 'a Smith machine with a barbell fixed on vertical guide rails', [
      'exp-smith-machine-squat', 'exp-smith-machine-hip-thrust',
      'exp-smith-machine-seated-calf-raise', 'exp-smith-machine-standing-calf-raise',
      'gym-floor-smith-machine-bench-press', 'gym-floor-incline-smith-machine-bench-press',
      'gym-floor-smith-machine-shoulder-press', 'gym-floor-smith-machine-row',
      'gym-floor-close-grip-smith-machine-bench-press',
      'g1-20_Overhand_Inverted_Row', 'g3-25_Underhand_Inverted_Row'
    ], 'Choose a Smith-specific move and set the catches. Presses, hip thrusts and seated calf raises need the specified stable bench or seat. Inverted rows require a securely locked bar at a suitable height.'),
    category('hip-thrust', 'Hip thrust machine', 'a hip thrust machine with a padded hip belt or lever and a back support', [
      'exp-hip-thrust-machine'
    ], 'Confirm a dedicated hip thrust setup rather than a seated leg press.'),
    category('standing-hip-thrust', 'Standing hip thrust machine', 'a dedicated standing hip thrust machine with upright supports and a padded hip resistance lever', [
      'gym-floor-standing-hip-thrust'
    ], 'Use the standing hip thrust setup shown by the manufacturer; this is separate from a seated hip thrust or a leg kickback.'),
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
      'exp-treadmill-jog', 'gym-floor-treadmill-walk', 'gym-floor-treadmill-run'
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
    category('stationary-bike', 'Upright stationary bike', 'an upright stationary exercise bicycle with fixed handlebars', [
      'gym-floor-stationary-cycling'
    ], 'Choose the general stationary cycling activity and record your actual time. An air bike with moving arms uses a different category.'),
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
    ], 'Use a stable bench with a height suitable for the chosen move. A bench alone does not establish access to dumbbells, a barbell rack or a safe step-up platform.'),
    category('power-rack', 'Power rack / barbell station', 'a power rack with adjustable barbell supports and safety catches', [
      'guide-barbell-back-squat', 'guide-barbell-front-squat', 'exp-barbell-bench-press',
      'exp-incline-barbell-bench-press', 'exp-close-grip-barbell-bench-press',
      'g2-04_Standing_Barbell_Overhead_Press', 'g2-05_Seated_Barbell_Shoulder_Press',
      'gym-floor-rack-pull', 'gym-floor-underhand-barbell-row'
    ], 'Barbell and plates are required. Presses also need the indicated bench; rack pulls need the bar supported at the intended height.'),
    category('dumbbells', 'Dumbbells', 'a gym dumbbell rack with pairs of handheld free weights', [
      'g0-13_Goblet_Squat', 'g0-14_Sumo_Dumbbell_Squat', 'g0-15_Reverse_Lunge',
      'g0-16_Bulgarian_Split_Squat', 'g0-20_Single_Leg_Dumbbell_RDL',
      'g1-08_Single_Arm_Dumbbell_Row', 'g1-09_Chest_Supported_Dumbbell_Row', 'g1-22_Dumbbell_Pullover',
      'g2-01_Standing_Dumbbell_Shoulder_Press', 'g2-02_Seated_Dumbbell_Shoulder_Press', 'g2-03_Arnold_Press',
      'g2-09_Dumbbell_Lateral_Raise', 'g2-11_Leaning_Lateral_Raise', 'g2-12_Dumbbell_Front_Raise',
      'g2-15_Bent_Over_Rear_Delt_Fly', 'g2-16_Chest_Supported_Rear_Delt_Fly', 'g2-20_Dumbbell_Scaption_Raise',
      'g2-21_Cuban_Rotation_to_Press', 'g2-22_Incline_Bench_Y_Raise',
      'g3-01_Standing_Dumbbell_Curl', 'g3-02_Alternating_Dumbbell_Curl', 'g3-03_Hammer_Curl',
      'g3-04_Cross_Body_Hammer_Curl', 'g3-06_Concentration_Curl', 'g3-07_Dumbbell_Preacher_Curl',
      'g3-08_Spider_Curl', 'g3-14_Zottman_Curl', 'g3-15_Seated_Dumbbell_Curl', 'g3-16_Seated_Hammer_Curl',
      'g4-11_Dumbbell_Side_Bend', 'g4-13_Suitcase_Carry',
      'guide-dumbbell-bench-press', 'guide-dumbbell-chest-fly', 'guide-overhead-dumbbell-triceps-extension',
      'guide-dumbbell-triceps-kickback', 'guide-standing-dumbbell-calf-raise',
      'guide-seated-wrist-curl', 'guide-seated-reverse-wrist-curl', 'guide-incline-dumbbell-curl',
      'exp-incline-dumbbell-bench-press', 'exp-dumbbell-floor-press', 'exp-single-arm-dumbbell-bench-press',
      'exp-dumbbell-squeeze-press', 'exp-incline-dumbbell-chest-fly', 'exp-single-arm-dumbbell-floor-press',
      'exp-dumbbell-lying-triceps-extension', 'exp-single-arm-overhead-dumbbell-extension',
      'exp-renegade-row', 'exp-dumbbell-shrug', 'exp-single-arm-standing-dumbbell-shoulder-press',
      'exp-dumbbell-push-press', 'exp-prone-dumbbell-w-raise', 'exp-prone-dumbbell-i-raise',
      'exp-side-lying-dumbbell-external-rotation', 'exp-side-lying-dumbbell-internal-rotation',
      'exp-dumbbell-serratus-punch', 'exp-incline-dumbbell-hammer-curl', 'exp-dumbbell-curl-isometric-hold',
      'exp-single-arm-incline-dumbbell-bench-press', 'exp-dumbbell-front-squat', 'exp-dumbbell-suitcase-squat',
      'exp-dumbbell-forward-lunge', 'exp-dumbbell-reverse-lunge', 'exp-dumbbell-split-squat',
      'exp-dumbbell-walking-lunge', 'exp-dumbbell-romanian-deadlift', 'exp-dumbbell-deadlift',
      'exp-b-stance-dumbbell-romanian-deadlift', 'exp-dumbbell-hip-thrust', 'exp-dumbbell-glute-bridge',
      'exp-dumbbell-lateral-lunge', 'exp-dumbbell-curtsy-lunge', 'exp-seated-dumbbell-calf-raise',
      'exp-single-leg-dumbbell-calf-raise', 'exp-suitcase-deadlift', 'exp-dumbbell-windmill',
      'exp-bear-plank-dumbbell-drag', 'exp-single-arm-overhead-carry',
      'exp-forearm-pronation-supination', 'exp-dumbbell-radial-deviation', 'exp-dumbbell-thruster', 'exp-farmers-carry',
      'gym-floor-neutral-grip-dumbbell-bench-press', 'gym-floor-two-arm-bent-over-dumbbell-row',
      'gym-floor-dumbbell-grip-hold', 'gym-floor-suitcase-hold', 'gym-floor-dumbbell-russian-twist'
    ], 'Choose the exercise with its required supports. Some moves need a flat or incline bench, preacher pad, suitable floor space, or a clear carrying area. A dumbbell rack alone does not provide those supports.'),
    category('ez-bar', 'EZ curl bar', 'a short angled EZ curl bar used with weight plates', [
      'g3-10_EZ_Bar_Curl', 'g3-11_Preacher_EZ_Bar_Curl', 'exp-ez-bar-lying-triceps-extension'
    ], 'Use an EZ bar and suitable plates. Preacher curls need a preacher pad; lying triceps extensions need a stable bench.'),
    category('preacher-bench', 'Preacher curl bench', 'a preacher curl bench with an angled upper-arm support pad and no built-in resistance', [
      'g3-07_Dumbbell_Preacher_Curl', 'g3-11_Preacher_EZ_Bar_Curl'
    ], 'Add the dumbbell or EZ bar shown in the selected guide. A preacher bench is separate from a resistance machine.'),
    category('incline-bench', 'Incline exercise bench', 'a padded incline exercise bench with an angled backrest', [
      'g1-09_Chest_Supported_Dumbbell_Row', 'g2-16_Chest_Supported_Rear_Delt_Fly',
      'g2-22_Incline_Bench_Y_Raise', 'guide-incline-dumbbell-curl',
      'exp-incline-dumbbell-bench-press', 'exp-incline-dumbbell-chest-fly',
      'exp-incline-dumbbell-hammer-curl', 'exp-single-arm-incline-dumbbell-bench-press'
    ], 'These moves also need dumbbells. Choose the bench angle and orientation shown by the guide; a decline bench is a different setup.'),
    category('weight-plates', 'Weight plates', 'gym weight plates stored on a plate tree', [
      'exp-plate-pinch-hold', 'g2-13_Plate_Front_Raise'
    ], 'These guides use plates directly. Other plate-loaded exercises require their specified bar or machine.'),
    category('ab-bench', 'Abdominal bench — confirm setup', 'an abdominal exercise bench whose incline and restraints need confirmation', [],
      'Confirm whether this is a sit-up bench, crunch bench, or another abdominal station. The floor crunch and floor sit-up guides do not establish the bench setup.', true),
    category('dual-smith', 'Dual Smith — confirm model', 'a gym station labeled dual Smith with unconfirmed independent bar or rail design', [],
      'Identify the actual model and bar movement before choosing a guide. Ordinary Smith exercises are not linked automatically.', true),
    category('high-incline', 'High incline — confirm machine', 'a gym station labeled high incline with an unconfirmed press path', [],
      'Confirm the actual press and backrest before choosing incline chest or shoulder instructions.', true),
    category('viking-machine', 'Viking machine — confirm model', 'a gym station labeled Viking with an unconfirmed pressing lever design', [],
      'Often a Viking press, but the map does not identify the machine or permitted movement.', true),
    category('super-hand-pulldown', 'Super Hand lat pulldown — confirm model', 'a specialty lat pulldown station labeled Super Hand', [],
      'Confirm the exact handles, support, and resistance system before selecting a generic pulldown guide.', true),
    category('multi-pulldown', 'Multi-pulldown — confirm model', 'a specialty gym station labeled multi pulldown', [],
      'The label does not identify its movements or attachments. It does not establish an adjustable cable station.', true),
    category('french-press-machine', 'French press machine — confirm setup', 'a French press triceps machine with an unconfirmed overhead resistance path', [],
      'Confirm the actual overhead French press setup. The upper-arm-supported triceps extension guide is not linked automatically.', true),
    category('dip-machine', 'Dip machine — confirm setup', 'a dip machine whose seated loaded or assisted design needs confirmation', [],
      'Determine whether the machine is a seated loaded dip or an assisted bodyweight station before selecting the matching guide.', true),
    category('t-bar-row-machine', 'T-bar row machine — confirm setup', 'a dedicated T-bar rowing machine whose supports need confirmation', [],
      'The existing T Bar Row uses a landmine bar. Confirm whether this station is the same setup or a supported lever machine.', true),
    category('glute-kickback-machine', 'Glute kickback machine — confirm setup', 'a glute kickback machine with an unconfirmed torso and knee support arrangement', [],
      'Confirm the machine supports and resistance pad. Cable kickbacks and standing hip extensions use different setups.', true),
    category('back-extension-unconfirmed', 'Back extension — confirm setup', 'a back extension station whose bench or seated machine design needs confirmation', [],
      'Choose the existing 45-degree guide only if this is a 45-degree back extension bench.', true),
    category('rear-raise-unconfirmed', 'Rear raise — confirm setup', 'a rear deltoid raise station whose reverse fly configuration needs confirmation', [],
      'Choose the reverse pec deck guide only when this machine supports that same rear-delt setup.', true),
    category('chin-up-machine', 'Chin-up machine — confirm setup', 'a chin-up station whose grips and assistance system need confirmation', [],
      'Choose the pull-up bar or assisted pull-up category after confirming the handles and assistance system.', true),
    category('arm-leg-cardio', 'Arm-and-leg cardio — confirm type', 'a cardio machine intended to use both arms and legs', [],
      'Confirm whether the actual machine is an elliptical, air bike, or another arm-and-leg trainer.', true)
  ]);

  const byId = new Map(categories.map(item => [item.id, item]));
  const exerciseIdsByCategory = new Map(categories.map(item => [item.id, new Set(item.exerciseIds)]));
  const categoriesByName = categories.slice().sort((a, b) => a.name.localeCompare(b.name));
  const aliases = {
    'cable-station': ['cable machine', 'functional trainer', 'dual adjustable pulley', 'cable crossover'],
    'plate-loaded-lat-pulldown': ['Forward FWHM-007', 'FWHM-007', 'wide lat pulldown', 'ワイドプルダウン', 'ラットプルダウン'],
    'lat-pulldown': ['ワイドプルダウン', 'ラットプルダウン'],
    'prone-leg-curl': ['Forward FWHM-012', 'FWHM-012', 'prone leg curl', 'lying hamstring curl', 'プローンレッグカール'],
    'standing-leg-curl': ['スタンディングレッグカール'],
    'hack-squat': ['Gymleco 244', '244 Hacklift', 'Hacklift', 'hack lift', 'ハックスクワット'],
    'belt-squat': ['ベルトスクワット'],
    'pendulum-squat': ['ペンデュラムスクワット'],
    'v-squat': ['Vスクワット', 'V squat'],
    'smith-machine': ['スミス'],
    'standing-hip-abduction': ['Gymleco 362', '362 Standing Abductor', 'standing abductor', 'standing hip abductor', 'スタンディングアウターサイ'],
    'hip-abduction-adduction': ['seated abductor', 'seated adductor', 'seated hip abduction', 'seated hip adduction', 'インナーサイ', 'アウターサイ', 'インナーサイ／アウターサイ'],
    'leg-press': ['レッグプレス'],
    'leg-extension': ['エクステンション', 'レッグエクステンション'],
    'single-leg-leg-extension': ['片足エクステンション', 'single leg leg extension'],
    'seated-calf-raise': ['シーテッドカーフレイズ', '（シーテッド）カーフレイズ'],
    'standing-calf-raise': ['カーフレイズ'],
    'standing-hip-thrust': ['スタンディングヒップスラスト'],
    'hip-thrust': ['ヒップスラスト'],
    'treadmill': ['トレッドミル'],
    'stair-climber': ['階段'],
    'stationary-bike': ['自転車', 'stationary bicycle', 'stationary cycling'],
    'power-rack': ['パワーラック'],
    'dumbbells': ['ダンベル'],
    'ez-bar': ['EZバー', 'EZ bar'],
    'exercise-bench': ['ベンチ'],
    'incline-bench': ['インクラインベンチ'],
    'preacher-bench': ['プリチャーカール台', 'プリチャーカール台（判読候補）', 'preacher curl stand'],
    'preacher-curl': ['プリチャーカールマシン'],
    'seated-cable-row': ['プーリーロー'],
    'chest-press': ['チェストプレス'],
    'incline-chest-press': ['インクラインチェストプレス'],
    'decline-chest-press': ['デクラインチェストプレス'],
    'standing-chest-press': ['スタンディングチェストプレス'],
    'incline-machine-fly': ['インクラインフライ'],
    'pec-deck': ['ペックフライ'],
    'shoulder-press': ['ショルダープレス'],
    'lateral-raise': ['ラテラルレイズ'],
    'assisted-pull-up-dip': ['アシストチンニング'],
    'pullover': ['プルオーバー'],
    'chest-supported-row': ['ローイングマシン'],
    'rowing-ergometer': ['ローイングマシン'],
    'weight-plates': ['おもり', '重り', 'weights'],
    'arm-leg-cardio': ['両手足'],
    'back-extension-unconfirmed': ['バックエクステンション', 'back extension'],
    'glute-kickback-machine': ['グルートキックバック', 'glute kickback machine'],
    'rear-raise-unconfirmed': ['リアレイズ', 'rear raise'],
    'dual-smith': ['デュアルスミス', 'dual smith', 'dual smith machine'],
    'high-incline': ['ハイインクライン', 'high incline', 'high incline press'],
    'viking-machine': ['バイキングマシン', 'viking press', 'viking machine'],
    'super-hand-pulldown': ['スーパーハンドラッドプルダウン', 'スーパーハンドラットプルダウン', 'super hand lat pulldown', 'superhand lat pulldown'],
    'multi-pulldown': ['マルチプルダウン', 'multi pulldown'],
    'french-press-machine': ['フレンチプレスマシン', 'french press machine'],
    'dip-machine': ['ディップスマシン', 'dip machine'],
    't-bar-row-machine': ['Tバーロー', 't bar row', 't bar row machine'],
    'chin-up-machine': ['チンニングマシン', 'chinning machine', 'chin up machine'],
    'ab-bench': ['腹筋台', 'abdominal bench']
  };
  const option = (id, name) => Object.freeze({ id, name });
  const cableOptions = Object.freeze({
    attachments: Object.freeze([
      option('single-handle', 'One handle'),
      option('two-handles', 'Two handles'),
      option('rope', 'Rope'),
      option('bar', 'Bar'),
      option('ankle-cuff', 'Ankle cuff')
    ]),
    heights: Object.freeze([
      option('low', 'Low'),
      option('mid', 'Mid'),
      option('high', 'High')
    ])
  });

  // These are compatible setups from the exercise guides. Alternative attachments
  // may work in the gym, but the filters only promise the setups listed here.
  const cableSetups = [
    ['single-handle', 'low', [
      'g2-10_Cable_Lateral_Raise', 'g2-14_Cable_Front_Raise', 'g3-18_Single_Arm_Cable_Curl', 'g3-20_Bayesian_Cable_Curl',
      'g4-16_Low_to_High_Cable_Woodchop', 'exp-cable-triceps-kickback', 'exp-single-arm-seated-cable-shoulder-press', 'exp-side-plank-cable-row'
    ]],
    ['single-handle', 'mid', [
      'g2-24_Cable_External_Rotation', 'g4-17_Horizontal_Cable_Rotation', 'g4-18_Pallof_Press',
      'exp-single-arm-cable-chest-press', 'exp-standing-single-arm-cable-row', 'exp-cable-internal-rotation'
    ]],
    ['single-handle', 'high', [
      'g1-15_Single_Arm_Cable_Pulldown', 'g4-15_High_to_Low_Cable_Woodchop', 'exp-single-arm-cable-triceps-pressdown', 'exp-cross-body-cable-triceps-extension'
    ]],
    ['two-handles', 'low', [
      'exp-low-to-high-cable-chest-fly', 'exp-supine-cable-chest-fly', 'exp-cable-scaption-raise', 'exp-cable-y-raise'
    ]],
    ['two-handles', 'mid', [
      'exp-standing-cable-chest-press', 'exp-standing-cable-chest-fly', 'exp-seated-cable-chest-press'
    ]],
    ['two-handles', 'high', [
      'g3-21_Overhead_Cable_Curl', 'exp-high-to-low-cable-chest-fly', 'exp-cable-rear-delt-fly'
    ]],
    ['rope', 'low', [
      'g3-19_Rope_Hammer_Cable_Curl', 'exp-seated-cable-overhead-triceps-extension',
      'exp-cable-split-squat', 'exp-cable-pull-through', 'exp-cable-reverse-lunge'
    ]],
    ['rope', 'high', [
      'g1-16_Straight_Arm_Cable_Pulldown', 'g1-24_Rope_Face_Pull', 'exp-standing-high-cable-row', 'exp-kneeling-cable-crunch'
    ]],
    ['bar', 'low', [
      'g3-17_Standing_Cable_Curl', 'exp-lying-cable-triceps-extension', 'exp-bent-over-cable-row', 'exp-supine-cable-pullover',
      'exp-cable-shrug', 'exp-cable-preacher-curl', 'exp-reverse-cable-curl', 'exp-cable-drag-curl'
    ]],
    ['bar', 'high', ['guide-cable-triceps-pushdown']],
    ['ankle-cuff', 'low', [
      'g0-09_Cable_Hip_Abduction', 'g0-10_Cable_Glute_Kickback', 'exp-standing-cable-leg-extension',
      'exp-standing-cable-leg-curl', 'exp-cable-hip-adduction'
    ]]
  ];
  const negativeCandidates = Object.freeze([
    Object.freeze({ id: 'not-gym', text: 'a photo of a household object that is not gym equipment' }),
    Object.freeze({ id: 'multiple-machines', text: 'a wide photo of a gym room with many different exercise machines' }),
    Object.freeze({ id: 'food', text: 'a photo of food or a meal' }),
    Object.freeze({ id: 'outdoor', text: 'an outdoor scene with a street trees or a landscape' }),
    Object.freeze({ id: 'animal', text: 'a photo of a cat dog or another animal' }),
    Object.freeze({ id: 'person', text: 'a portrait or selfie of a person without exercise equipment' })
  ]);

  function get(id) { return byId.get(id) || null; }
  function searchKey(text) {
    return String(text ?? '').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, '');
  }
  const searchTerms = new Map(categoriesByName.map(item => [
    item.id, [item.name, item.id, ...(aliases[item.id] || [])].map(searchKey)
  ]));
  function search(query) {
    const key = searchKey(query);
    if (!key) return categoriesByName.slice();
    return categoriesByName.map(item => {
      const terms = searchTerms.get(item.id);
      if (terms.includes(key)) return { item, rank: 0 };
      if (terms.some(term => term.startsWith(key))) return { item, rank: 1 };
      return { item, rank: terms.some(term => term.includes(key)) ? 2 : 3 };
    }).filter(({ rank }) => rank < 3).sort((a, b) => a.rank - b.rank).map(({ item }) => item);
  }
  function labelMatches(query) {
    const key = searchKey(query);
    if (!key) return [];
    return categoriesByName.filter(item => searchTerms.get(item.id).includes(key));
  }
  function matches(exercise, id, setup) {
    if (id === '' || id == null) return true;
    const allowed = exerciseIdsByCategory.get(id);
    if (!allowed || !exercise || exercise.prenatal) return false;
    const exerciseId = typeof exercise === 'string' ? exercise : exercise.id;
    if (!allowed.has(exerciseId)) return false;
    if (id !== 'cable-station' || !setup) return true;
    const attachment = setup.attachment === 'any' ? '' : setup.attachment;
    const height = setup.height === 'any' ? '' : setup.height;
    if (!attachment && !height) return true;
    return cableSetups.some(([tool, position, exercises]) =>
      (!attachment || attachment === tool) && (!height || height === position) && exercises.includes(exerciseId)
    );
  }
  function candidates() {
    return categories.filter(item => !item.referenceOnly).map(item => ({ id: item.id, text: 'a photo of ' + item.description }))
      .concat(negativeCandidates.map(item => ({ id: item.id, text: item.text })));
  }

  return Object.freeze({ categories, cableOptions, get, search, labelMatches, matches, candidates });
});
