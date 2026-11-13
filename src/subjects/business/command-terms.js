/*
 * Business Quest — subtopics, IB command terms and markbands.
 * Used by the site (what each command term asks for, tips) and by the
 * marking job (marker/), which puts the rule for the command term into the
 * prompt. Everything here is public: no markscheme content.
 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});

  BQ.SUBS = [
    { id: '1.1', title: 'Introduction to business management' },
    { id: '1.2', title: 'Types of business entities' },
    { id: '1.3', title: 'Business objectives' },
    { id: '1.4', title: 'Stakeholders' },
    { id: '1.5', title: 'Growth and evolution' },
    { id: '1.6', title: 'Multinational companies' },
  ];

  /*
   * what: the IB definition of the command term (what the question demands)
   * tip:  how to answer, shown to the student before writing
   * rule: how the examiner applies it; goes into the marking prompt
   */
  BQ.CT = {
    Define: {
      ao: 1, what: 'Give the precise meaning of a word, phrase, concept or physical quantity.',
      tip: 'One or two precise sentences with the right technical terms. No examples needed unless asked.',
      rule: 'A precise, technically correct meaning is required. Vague everyday wording earns at most half the marks. Examples are not needed unless the question asks for them.',
    },
    State: {
      ao: 1, what: 'Give a specific name, value or other brief answer without explanation or calculation.',
      tip: 'Short and exact.',
      rule: 'Brief, specific answers; no explanation is needed or rewarded.',
    },
    Outline: {
      ao: 1, what: 'Give a brief account or summary.',
      tip: 'Each point needs a short development (a sentence), not just one word.',
      rule: 'Each point must be briefly developed. Single words or a bare list earn at most half the marks for that point.',
    },
    Describe: {
      ao: 1, what: 'Give a detailed account.',
      tip: 'Go through each part or stage in detail.',
      rule: 'A detailed account of each part is required; a list of headings earns at most half.',
    },
    Classify: {
      ao: 1, what: 'Arrange or order by class or category.',
      tip: 'Put each item in the right category; say which category clearly.',
      rule: 'Each item must be placed in the correct category; one mark per correct placement unless the markscheme says otherwise.',
    },
    Identify: {
      ao: 4, what: 'Provide an answer from a number of possibilities.',
      tip: 'Pick the right answer for each part. Add a reason only if the question asks for one.',
      rule: 'Each part must give the correct option; explanation is not required beyond what the question asks.',
    },
    Distinguish: {
      ao: 2, what: 'Make clear the differences between two or more concepts or items.',
      tip: 'Say how they DIFFER, using “whereas” or “in contrast”. Two separate definitions are not enough.',
      rule: 'The difference must be made explicit with a direct contrast between the items. Two separate definitions with no explicit comparison earn AT MOST HALF the marks. Give examples if the question asks for them.',
    },
    Explain: {
      ao: 2, what: 'Give a detailed account including reasons or causes.',
      tip: 'Use chains of reasoning: “because… so… which means…”.',
      rule: 'Each point needs a cause and a consequence (a chain of reasoning: because… so… which means…). A bare list of points without reasons earns AT MOST HALF the marks.',
    },
    Analyse: {
      ao: 3, what: 'Break down in order to bring out the essential elements or structure.',
      tip: 'Break the issue into parts, show cause and effect, and use the case.',
      rule: 'The answer must break the issue into parts, show cause-and-effect links and apply them to the case. Description without analysis earns at most half.',
    },
    Discuss: {
      ao: 3, what: 'Offer a considered and balanced review that includes a range of arguments, factors or hypotheses. Opinions or conclusions should be presented clearly and supported by appropriate evidence.',
      tip: 'Arguments for AND against, applied to the case, then a conclusion that answers the question.',
      rule: 'A balanced review is required: arguments on both sides, applied to the context, ending in a supported conclusion. On a 10-mark question a one-sided answer (no counter-argument) cannot score above 5–6, and an answer with no conclusion cannot score above 7–8. On shorter questions scale these caps: one-sided at most 60% of the marks, no conclusion at most 80%.',
    },
    Evaluate: {
      ao: 3, what: 'Make an appraisal by weighing up the strengths and limitations.',
      tip: 'Weigh the positives against the negatives, then give a judgement.',
      rule: 'Strengths AND limitations must be weighed against each other, leading to a supported judgement. On a 10-mark question a one-sided answer cannot score above 5–6, and an answer with no judgement cannot score above 7–8. On shorter questions scale these caps: one-sided at most 60% of the marks, no judgement at most 80%.',
    },
    Recommend: {
      ao: 3, what: 'Present an advisable course of action with appropriate supporting evidence, reason or argument.',
      tip: 'Choose one clear option and justify it with reasons from the case.',
      rule: 'A clear recommendation must be made and justified with reasons linked to the case. Without a clear recommendation, at most half the marks.',
    },
    Calculate: {
      ao: 4, what: 'Obtain a numerical answer showing the relevant stages in the working.',
      tip: 'Show every step and the units ($). A wrong final number can still get method marks.',
      rule: 'Check every figure. Award method marks for correct working even when the final answer is wrong (own-figure rule: follow through a wrong figure correctly used later). Say exactly which step went wrong. A correct final answer with no working may lose method marks if the markscheme asks for working.',
    },
    Construct: {
      ao: 4, what: 'Display information in a diagrammatic or logical form.',
      tip: 'Lay it out clearly: headings, order, and the diagram described in words.',
      rule: 'The information must be presented in a clear, logical structure with each element correctly placed and labelled.',
    },
  };

  /** IB markbands for 10-mark questions (Discuss, Evaluate, Recommend...). */
  BQ.MARKBANDS = [
    { band: '0', text: 'The work does not reach a standard described by the descriptors below.' },
    { band: '1–2', text: 'Little understanding of the demands of the question. Few business terms, little or no application to the case, mostly descriptive or irrelevant.' },
    { band: '3–4', text: 'Some understanding of the question. Some relevant knowledge and terms, limited application to the case, largely descriptive or one-sided.' },
    { band: '5–6', text: 'Understanding of most of the question. Relevant knowledge and terms, some application and some analysis, but the answer is unbalanced or has no real conclusion.' },
    { band: '7–8', text: 'Good understanding. Relevant knowledge and terms used appropriately, balanced analysis applied to the case, a conclusion that is only partly supported.' },
    { band: '9–10', text: 'Good understanding of all of the question. Thorough, balanced and well applied, with evaluation leading to a well-substantiated judgement.' },
  ];

  /** Named cases in the bank plus typical case wording. */
  const CASE_RE = /Thomas Cook|United Airlines|GreenRide|VoltCell|Lumen|[A-Z][a-z]+ ?(Ltd|plc|Inc|Cook|Airlines)\b|ride-hailing|bakery|café|supermarket|airport|restaurant|logistics|furniture|non-profit|soft-drink|clothing shop|juice producer|street stall/i;

  /** Plain text of a question, with tables as "a | b | c" rows. */
  BQ.questionText = function (q) {
    return q.q.map(function (l) {
      if (l.indexOf('<table') !== 0) return l;
      return l.replace(/<\/(td|th)>\s*<(td|th)[^>]*>/gi, ' | ')
        .replace(/<\/tr>/gi, '\n').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .split('\n').map(function (s) { return s.trim(); }).filter(Boolean).join('\n');
    }).join('\n');
  };

  /** Does the question give a case / context the answer must use? */
  BQ.hasCase = function (q) { return CASE_RE.test(BQ.questionText(q)); };

  BQ.ct = function (name) { return BQ.CT[name] || BQ.CT.Explain; };
})(typeof window !== 'undefined' ? window : globalThis);
