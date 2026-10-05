/* Screenshot OCR is untrusted data. This parser only extracts reviewable values;
   it never runs text, follows instructions, or guesses missing dates/durations. */
(function (root) {
  'use strict';

  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const MONTH_PATTERN = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const DURATION_LABEL = /^(?:(?:total|moving|elapsed|workout|exercise|activity)\s+)?(?:time|duration)(?:\s*\((?:h+h?:mm:ss|mm:ss|h+h?:mm|minutes?|mins?)\))?\s*:?\s*/i;
  const EXCLUDED_DURATION = /\b(?:start|end|finish|pace|split|lap|rest|recovery|average|avg|best|fastest)\b/i;
  const METRIC_LINE = /\b(?:distance|calories|kcal|heart rate|bpm|pace|speed|steps|elevation|ascent|descent|cadence|training effect|duration|total time|moving time|elapsed time|start time|end time)\b/i;

  function unique(values) { return [...new Set(values)]; }
  function number(value) { return Number(value.replace(',', '.')); }
  function dateKey(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (year < 1900 || year > 2199 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  function referenceDate(today) {
    if (typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)) {
      const [year, month, day] = today.split('-').map(Number);
      return dateKey(year, month, day);
    }
    if (today instanceof Date && !Number.isNaN(today.getTime())) return dateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
    return null;
  }
  function monthNumber(name) { return MONTHS.findIndex(month => month.slice(0, 3) === name.toLowerCase().slice(0, 3)) + 1; }

  function parseDate(text, today, warnings) {
    const candidates = [], ambiguous = [];
    function add(year, month, day) {
      const value = dateKey(year, month, day);
      if (value) candidates.push(value);
      else warnings.push('A date in the screenshot is invalid. Check the workout date.');
    }
    for (const match of text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) add(+match[1], +match[2], +match[3]);
    for (const match of text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g)) {
      const a = +match[1], b = +match[2], year = +match[3];
      if (a > 12 && b <= 12) add(year, b, a);
      else if (b > 12 && a <= 12) add(year, a, b);
      else if (a === b && a >= 1 && a <= 12) add(year, a, b);
      else ambiguous.push(match[0]);
    }
    for (const match of text.matchAll(new RegExp('\\b(' + MONTH_PATTERN + ')\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,\\s*|\\s+)(\\d{4})\\b', 'gi'))) add(+match[3], monthNumber(match[1]), +match[2]);
    for (const match of text.matchAll(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(' + MONTH_PATTERN + ')\\.?(?:\\s*,\\s*|\\s+)(\\d{4})\\b', 'gi'))) add(+match[3], monthNumber(match[2]), +match[1]);
    if (/\btoday\b/i.test(text)) {
      if (today) candidates.push(today);
      else warnings.push('“Today” needs a reference date. Choose the workout date.');
    }
    if (/\byesterday\b/i.test(text)) {
      if (today) {
        const date = new Date(today + 'T12:00:00Z');
        date.setUTCDate(date.getUTCDate() - 1);
        candidates.push(dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()));
      } else warnings.push('“Yesterday” needs a reference date. Choose the workout date.');
    }
    if (ambiguous.length) warnings.push('The numeric date could use day/month or month/day order. Choose the workout date.');
    const distinct = unique(candidates);
    if (distinct.length > 1) warnings.push('Several different dates were found. Choose the workout date.');
    if (!distinct.length && !ambiguous.length) warnings.push('No complete workout date was found. Choose the workout date.');
    if (ambiguous.length || distinct.length !== 1) return null;
    if (today && distinct[0] > today) warnings.push('The detected date is in the future. Check it before saving a completed workout.');
    return distinct[0];
  }

  function parseClock(value) {
    const match = value.match(/\b(\d{1,2}):([0-5]\d)(?::[0-5]\d)?\s*(a\.?m\.?|p\.?m\.?)?\b/i);
    if (!match) return null;
    let hour = +match[1];
    if (match[3]) {
      if (hour < 1 || hour > 12) return null;
      hour = hour % 12 + (/^p/i.test(match[3]) ? 12 : 0);
    } else if (hour > 23) return null;
    return `${String(hour).padStart(2, '0')}:${match[2]}`;
  }
  function parseTime(lines, warnings) {
    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\b(?:start(?:ed)?(?:\s+time)?|began)\s*:?/i.test(line)) {
        const tail = line.replace(/^.*?\b(?:start(?:ed)?(?:\s+time)?|began)\s*:?\s*/i, '');
        const value = parseClock(tail || lines[i + 1] || '');
        if (value) candidates.push(value);
      } else if (/(?:\btoday\b|\byesterday\b|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i.test(line) || new RegExp(MONTH_PATTERN + '\\.?\\s+\\d{1,2}', 'i').test(line)) {
        if (!/\b(?:end|finish|duration|total time)\b/i.test(line)) {
          const value = parseClock(line);
          if (value) candidates.push(value);
        }
      }
    }
    const distinct = unique(candidates);
    if (distinct.length > 1) warnings.push('Several start times were found. Confirm the start time.');
    return distinct.length === 1 ? distinct[0] : null;
  }

  function durationValue(line, format) {
    if (!line || /\b(?:a\.?m\.?|p\.?m\.?)\b/i.test(line) || /(?:\/\s*(?:km|mi)|per\s+(?:km|mile))\b/i.test(line)) return null;
    let value = 0, count = 0;
    const unitPattern = /(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)(?=\s|\d|$)/gi;
    for (const match of line.matchAll(unitPattern)) {
      // A standalone "m" after a number can be metres; require a duration label.
      if (match[2].toLowerCase() === 'm' && !format) continue;
      const unit = match[2].toLowerCase();
      value += number(match[1]) * (unit.startsWith('h') ? 60 : unit.startsWith('s') ? 1 / 60 : 1);
      count++;
    }
    if (count) return { value, ambiguous: false };
    const triple = line.match(/(?:^|\s)(\d{1,3}):([0-5]\d):([0-5]\d)(?:\s|$)/);
    if (triple) return { value: +triple[1] * 60 + +triple[2] + +triple[3] / 60, ambiguous: false };
    const pair = line.match(/(?:^|\s)(\d{1,3}):([0-5]\d)(?:\s|$)/);
    if (pair) {
      if (/h+h?:mm(?!:ss)/i.test(format || '')) return { value: +pair[1] * 60 + +pair[2], ambiguous: false };
      if (/mm:ss/i.test(format || '') || +pair[1] > 23) return { value: +pair[1] + +pair[2] / 60, ambiguous: false };
      return { value: null, ambiguous: true };
    }
    if (/\b(?:minutes?|mins?)\b/i.test(format || '') && /^\d+(?:[.,]\d+)?$/.test(line)) return { value: number(line), ambiguous: false };
    return null;
  }
  function parseDuration(lines, warnings) {
    const candidates = [], unlabelled = [];
    let ambiguous = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (EXCLUDED_DURATION.test(line)) continue;
      const label = line.match(DURATION_LABEL);
      if (label) {
        const tail = line.slice(label[0].length).trim();
        const following = lines[i + 1] || '';
        const preceding = lines[i - 1] || '';
        const result = durationValue(tail || following, label[0]) || (!tail ? durationValue(preceding, label[0]) : null);
        if (result) {
          ambiguous ||= result.ambiguous;
          if (result.value !== null) candidates.push({ value: result.value, rank: /^(?:total|workout|exercise|activity)\b/i.test(label[0]) ? 3 : /^(?:moving|elapsed)\b/i.test(label[0]) ? 1 : 2 });
        }
      } else if (!METRIC_LINE.test(line)) {
        const previous = lines[i - 1] || '', next = lines[i + 1] || '';
        if (EXCLUDED_DURATION.test(previous) || EXCLUDED_DURATION.test(next)) continue;
        // Only bare values may become unlabelled duration candidates; status-bar
        // clock times, dates, distances and prose are deliberately excluded.
        if (/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(line) || /^\d{1,3}:[0-5]\d$/.test(line) || /^\d+(?:[.,]\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec|s)(?:\s*\d+(?:[.,]\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec|s))*$/i.test(line)) {
          const result = durationValue(line, null);
          if (result) { ambiguous ||= result.ambiguous; if (result.value !== null) unlabelled.push(result.value); }
        }
      }
    }
    const bestRank = candidates.length ? Math.max(...candidates.map(candidate => candidate.rank)) : 0;
    const values = unique((candidates.length ? candidates.filter(candidate => candidate.rank === bestRank).map(candidate => candidate.value) : unlabelled).map(value => Math.round(value * 100) / 100));
    if (values.length > 1) warnings.push('Several workout durations were found. Confirm the duration.');
    if (values.length === 1 && values[0] > 0 && values[0] <= 1440) return values[0];
    if (values.some(value => value <= 0 || value > 1440)) warnings.push('The duration is outside 1 day. Enter the correct duration.');
    else if (ambiguous && !values.length) warnings.push('A two-part time could mean minutes:seconds or hours:minutes. Enter the workout duration.');
    else if (!values.length) warnings.push('No clear workout duration was found. Enter its minutes.');
    return null;
  }

  function parseActivity(lines, warnings) {
    const activityLines = lines.filter(line => !METRIC_LINE.test(line) && !/^\d/.test(line));
    const patterns = [
      [/\b(?:treadmill|tread mill)\b/i, 'Treadmill'],
      [/\b(?:hiking|hike)\b/i, 'Hiking'],
      [/\b(?:casual|leisure)\s+walk(?:ing)?\b/i, 'Casual Walking'],
      [/\b(?:outdoor|outside)\s+walk(?:ing)?\b/i, 'Outdoor Walking'],
      [/\b(?:indoor|inside)\s+walk(?:ing)?\b/i, 'Indoor Walking'],
      [/\b(?:walking|walk)\b/i, 'Walking'],
      [/\b(?:trail)\s+run(?:ning)?\b/i, 'Trail Running'],
      [/\b(?:outdoor|outside)\s+run(?:ning)?\b/i, 'Outdoor Running'],
      [/\b(?:indoor|inside)\s+run(?:ning)?\b/i, 'Indoor Running'],
      [/\b(?:running|run|jogging|jog)\b/i, 'Running'],
      [/\b(?:indoor|stationary)\s+(?:cycling|cycle|biking|bike|ride)\b/i, 'Indoor Cycling'],
      [/\b(?:cycling|cycle|biking|bike|ride)\b/i, 'Cycling'],
      [/\b(?:swimming|swim|pool swim|open water swim)\b/i, 'Swimming'],
      [/\b(?:strength(?: training)?|weight(?:s|lifting| training)|resistance training|gym|functional training)\b/i, 'Strength Training'],
      [/\b(?:rowing|row|rower)\b/i, 'Rowing'],
      [/\byoga\b/i, 'Yoga'],
      [/\belliptical\b/i, 'Elliptical'],
      [/\bpilates\b/i, 'Pilates'],
      [/\b(?:stair(?:s| climber| climbing)|stairmaster|stepper)\b/i, 'Stair Climbing'],
      [/\b(?:hiit|high intensity interval training)\b/i, 'HIIT'],
      [/\b(?:dance|dancing)\b/i, 'Dancing']
    ];
    for (const [pattern, name] of patterns) if (activityLines.some(line => pattern.test(line))) return name;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(?:activity(?: type| name)?|workout(?: type| name)?|exercise(?: type| name)?)\s*:\s*(.*)$/i);
      if (match) {
        const name = (match[1] || lines[i + 1] || '').trim();
        if (name && name.length <= 80 && !METRIC_LINE.test(name) && !/^\d/.test(name)) return name;
      }
    }
    // Freely named activities need an explicit field; guessing from arbitrary
    // OCR prose could label notes or embedded instructions as a workout.
    warnings.push('No clear activity name was found. Choose or enter the activity.');
    return '';
  }

  function parseDistance(lines, warnings) {
    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\b(?:elevation|ascent|descent|climb|pace|speed|length|height)\b/i.test(line)) continue;
      const previous = lines[i - 1] || '', next = lines[i + 1] || '';
      if (/\b(?:elevation|ascent|descent|pace|speed)\b/i.test(previous) && !/distance/i.test(next)) continue;
      const source = /\bdistance\b/i.test(line) ? line + ' ' + next + ' ' + (lines[i + 2] || '') : line;
      const match = source.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(kilomet(?:er|re)s?|km|miles?|mi|met(?:er|re)s?|m)\b/i);
      if (match && !/\s*\//.test(source.slice(match.index + match[0].length, match.index + match[0].length + 5))) {
        const value = number(match[1]), unit = /^k/i.test(match[2]) ? 'km' : /^mi/i.test(match[2]) ? 'mi' : 'm';
        if (value >= 0 && value <= 1000000 && (unit !== 'm' || /\bdistance\b/i.test(line + ' ' + previous + ' ' + next))) candidates.push({ value, unit });
      }
    }
    const distinct = unique(candidates.map(value => JSON.stringify(value))).map(value => JSON.parse(value));
    if (distinct.length > 1) warnings.push('Several distances were found. Confirm the workout distance.');
    return distinct.length === 1 ? distinct[0] : null;
  }

  function parseCalories(lines, warnings) {
    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/\b(?:calories|kcal|cals?)\b/i.test(line)) continue;
      const text = line + ' ' + (lines[i + 1] || '');
      const match = text.match(/\b(\d{1,6}(?:[.,]\d+)?)\s*(?:kcal|cals?|calories)\b/i) || text.match(/\b(?:calories|kcal|cals?)\s*:?\s*(\d{1,6}(?:[.,]\d+)?)\b/i) || (/^(?:(?:active|total|exercise|workout)\s+)?(?:calories|kcal|cals?)\s*:?$/i.test(line) ? (lines[i - 1] || '').match(/^(\d{1,6}(?:[.,]\d+)?)\s*(?:kcal|cals?)?$/i) : null);
      if (match) candidates.push({ value: number(match[1]), rank: /total/i.test(line) ? 3 : /active/i.test(line) ? 2 : 1 });
    }
    const rank = candidates.length ? Math.max(...candidates.map(candidate => candidate.rank)) : 0;
    const values = unique(candidates.filter(candidate => candidate.rank === rank).map(candidate => candidate.value));
    if (values.length > 1) warnings.push('Several calorie values were found. Confirm the workout calories.');
    return values.length === 1 ? values[0] : null;
  }

  function parse(input, options) {
    const rawText = typeof input === 'string' ? input.slice(0, 30000) : '';
    const text = rawText.normalize('NFKC').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[\u2010-\u2014]/g, '-');
    const lines = text.split('\n').map(line => line.trim().replace(/[\t ]+/g, ' ')).filter(Boolean);
    const warnings = [];
    const today = referenceDate(options && options.today);
    const providers = [];
    if (/\b(?:garmin(?: connect)?|connect iq)\b/i.test(text)) providers.push('Garmin');
    if (/\b(?:apple(?: watch| fitness| health)?|fitness\+|activity rings)\b/i.test(text)) providers.push('Apple');
    if (/\b(?:samsung(?: health| watch)?|galaxy watch)\b/i.test(text)) providers.push('Samsung');
    if (providers.length > 1) warnings.push('Several watch providers were found. Confirm the screenshot source.');
    const result = {
      provider: providers.length === 1 ? providers[0] : '',
      activityName: parseActivity(lines, warnings),
      date: parseDate(text, today, warnings),
      time: parseTime(lines, warnings),
      minutes: parseDuration(lines, warnings),
      distance: parseDistance(lines, warnings),
      calories: parseCalories(lines, warnings),
      warnings: null,
      rawText
    };
    if (!rawText.trim()) warnings.unshift('No readable text was found. Fill in the workout details manually.');
    if (typeof input === 'string' && input.length > rawText.length) warnings.push('The screenshot text was shortened for review.');
    result.warnings = unique(warnings);
    return result;
  }

  const api = Object.freeze({ parse });
  root.GymScreenshotParser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
