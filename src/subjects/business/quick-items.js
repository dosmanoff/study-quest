/* Quick-check items: auto-marked. Multiple choice, classification (from the question bank) and number generators. */
(function () {
  'use strict';
  function mc(id, sub, q, opts, a, why) { return { id: id, sub: sub, kind: 'choice', q: q, opts: opts, a: a, why: why }; }
  function cls(id, sub, q, opts, ans, why) { return { id: id, sub: sub, kind: 'choice', q: q, opts: opts, a: opts.indexOf(ans), why: why }; }

  const SECT = ['Primary', 'Secondary', 'Tertiary', 'Quaternary'];
  const FV = ['Fixed', 'Variable'];
  const ANS = ['Market penetration', 'Product development', 'Market development', 'Diversification'];
  const INTEG = ['Horizontal', 'Backward vertical', 'Forward vertical', 'Conglomerate'];
  const GRID = ['Monitor (minimal effort)', 'Keep informed', 'Keep satisfied', 'Key player: manage closely'];

  const ITEMS = [
    // 1.1
    mc('m1', '1.1', 'Which is the best definition of a business?', ['An organisation that aims to make a profit', 'An organisation that uses resources to provide goods and/or services that meet people’s needs and wants', 'Any organisation owned by private individuals', 'An organisation that sells physical products'], 1, 'A business turns inputs into goods or services for customers. Profit is a common aim but not part of the definition.'),
    mc('m2', '1.1', 'Which resource (factor of production) combines the others and takes the risk?', ['Human', 'Physical', 'Financial', 'Enterprise'], 3, 'Enterprise is the idea plus the drive and risk-taking that organises human, physical and financial resources.'),
    mc('m3', '1.1', 'Added value is calculated as…', ['Selling price − cost of bought-in materials', 'Revenue − all costs', 'Selling price × quantity sold', 'Profit ÷ revenue'], 0, 'Added value = selling price − cost of bought-in inputs. Revenue − all costs is profit.'),
    mc('m4', '1.1', 'Which is an example of labour-intensive production?', ['An oil refinery', 'A hair salon', 'A car plant using robots', 'A power station'], 1, 'Labour-intensive means mostly people relative to machinery.'),
    mc('m5', '1.1', 'Which of these is a need rather than a want?', ['A games console', 'A foreign holiday', 'Clean drinking water', 'Designer trainers'], 2, 'Needs are essential for survival: food, water, shelter, basic healthcare.'),
    mc('m6', '1.1', 'Which function is responsible for recruitment, training and appraisal?', ['Marketing', 'Operations', 'Human resources', 'Finance and accounts'], 2, 'HR manages the people: workforce planning, recruitment, training, appraisal and dismissal.'),
    mc('m7', '1.1', 'Which is a controllable cause of business failure?', ['A recession', 'A pandemic', 'Poor cash-flow management', 'A new law'], 2, 'Controllable causes come from decisions managers could have avoided. The others come from the external environment.'),
    mc('m8', '1.1', 'As an economy develops, employment usually shifts…', ['from tertiary to primary', 'from primary to secondary, then to tertiary and quaternary', 'from quaternary to secondary', 'it does not change'], 1, 'Sectoral change: mechanisation cuts jobs in the primary sector and rising incomes shift spending to manufactured goods and then services.'),
    mc('m9', '1.1', 'Why does a new business write a business plan? Choose the best reason.', ['It is required by law', 'Banks and investors want evidence that the idea is viable', 'It guarantees success', 'It replaces market research'], 1, 'A plan helps obtain finance and makes the owner think through costs, competitors and marketing.'),
    cls('c10a', '1.1', 'Which sector? Offshore oil drilling', SECT, 'Primary', 'Extracting natural resources is primary.'),
    cls('c10b', '1.1', 'Which sector? Assembling electric cars', SECT, 'Secondary', 'Manufacturing and assembly are secondary.'),
    cls('c10c', '1.1', 'Which sector? A dental clinic', SECT, 'Tertiary', 'Services to people are tertiary.'),
    cls('c10d', '1.1', 'Which sector? An artificial intelligence research lab', SECT, 'Quaternary', 'Knowledge-based work, R&D and ICT are quaternary.'),
    cls('c10e', '1.1', 'Which sector? A fishing fleet', SECT, 'Primary', 'Taking resources from nature is primary.'),
    cls('c10f', '1.1', 'Which sector? A brewery making beer', SECT, 'Secondary', 'Turning raw materials into a product is secondary.'),
    // 1.2
    mc('m20', '1.2', 'Unlimited liability means…', ['Owners can lose only what they invested', 'The owner is personally responsible for all the business’s debts', 'The business cannot borrow money', 'The government guarantees the debts'], 1, 'With unlimited liability there is no legal separation, so personal possessions can be taken to repay business debts.'),
    mc('m21', '1.2', 'An incorporated business is…', ['a business with one owner', 'a separate legal entity from its owners', 'always owned by the government', 'a business with unlimited liability'], 1, 'A company can own assets, sue and be sued in its own name, and its owners have limited liability.'),
    mc('m22', '1.2', 'Which type of organisation gives its owners limited liability?', ['Sole trader', 'Ordinary partnership', 'Privately held company', 'All of them'], 2, 'Companies are incorporated, so shareholders have limited liability.'),
    mc('m23', '1.2', 'Which is usually included in a deed of partnership?', ['The company’s share price', 'How profits are divided between partners', 'The names of all customers', 'The mission statement'], 1, 'A deed sets out roles, capital contributed, profit split, liabilities and what happens if a partner leaves.'),
    mc('m24', '1.2', 'A publicly held company differs from a privately held company because it…', ['has unlimited liability', 'can sell shares to the general public on a stock exchange', 'does not need to publish accounts', 'is owned by the government'], 1, 'It can raise more capital but must publish accounts and risks takeover.'),
    mc('m25', '1.2', 'A key feature of a cooperative is…', ['one member, one vote', 'votes proportional to shares owned', 'owned by the government', 'shares traded on a stock exchange'], 0, 'Cooperatives are owned and run by members, each usually with one vote.'),
    mc('m26', '1.2', 'What happens to a surplus in a non-profit organisation?', ['It is paid to the owners as dividends', 'It is reinvested in the organisation’s purpose', 'It is paid to the government', 'It must be given back to donors'], 1, 'A surplus is never distributed to owners; it goes back into the cause.'),
    mc('m27', '1.2', 'Which organisation is in the public sector?', ['A family bakery', 'A state school', 'A charity', 'A listed bank'], 1, 'Public sector organisations are owned and controlled by the government.'),
    mc('m28', '1.2', 'A for-profit social enterprise…', ['relies mainly on donations', 'earns revenue from sales and uses much of its profit for a social or environmental purpose', 'is owned by the government', 'cannot make a profit'], 1, 'It trades like a business but puts its social purpose first. A charity/NGO relies on donations.'),
    mc('m29', '1.2', 'A dividend is…', ['interest paid on a loan', 'a share of profit after tax paid to shareholders', 'the price of one share', 'a tax on profit'], 1, 'The board of directors decides how much (if any) to pay per share.'),
    // 1.3
    mc('m37', '1.3', 'A vision statement describes…', ['the organisation’s long-term aspiration: where it wants to be', 'its daily targets', 'what it does today, for whom and how', 'its legal structure'], 0, 'Vision = long-term, inspirational. Mission = current purpose.'),
    mc('m38', '1.3', 'Objectives differ from aims because objectives are…', ['general and qualitative', 'specific, measurable targets that help achieve the aims', 'always about profit', 'set by the government'], 1, 'Aims are broad statements; objectives are SMART targets.'),
    mc('m39', '1.3', 'In SMART, the T stands for…', ['Tactical', 'Time-bound', 'Targeted', 'Tested'], 1, 'Specific, Measurable, Achievable, Realistic, Time-bound.'),
    mc('m40', '1.3', 'Strategic objectives are…', ['short-term targets set by team leaders', 'long-term objectives set by senior management that affect the whole organisation', 'medium-term targets set by middle managers', 'day-to-day targets'], 1, 'Strategic = long term, senior managers. Tactical = medium term, middle managers. Operational = day-to-day.'),
    mc('m41', '1.3', 'Why might survival be the main objective of a new business?', ['Profit is illegal in the first year', 'High start-up costs and few loyal customers make profit unlikely at first', 'Shareholders demand it', 'It is required for a business plan'], 1, 'First the business must cover costs and keep enough cash to keep trading.'),
    mc('m42', '1.3', 'Corporate social responsibility (CSR) is…', ['obeying the law', 'a voluntary commitment to act ethically and consider all stakeholders, beyond what the law requires', 'paying dividends', 'a type of tax'], 1, 'CSR goes beyond legal requirements.'),
    mc('m43', '1.3', '“Greenwashing” means…', ['cleaning factories with eco products', 'exaggerating or faking environmental claims to look responsible', 'investing in renewable energy', 'a government environmental tax'], 1, 'It is a risk of CSR when claims are not genuine.'),
    mc('m44', '1.3', 'In a SWOT analysis, which elements are external?', ['Strengths and weaknesses', 'Opportunities and threats', 'Strengths and opportunities', 'Weaknesses and threats'], 1, 'S and W are internal; O and T come from the external environment.'),
    mc('m45', '1.3', 'A new law on whether ride-hailing drivers are employees is which STEEPLE factor?', ['Social', 'Ethical', 'Legal', 'Economic'], 2, 'Laws and regulations are Legal factors.'),
    mc('m46', '1.3', 'Which Ansoff strategy is the riskiest?', ['Market penetration', 'Product development', 'Market development', 'Diversification'], 3, 'Diversification means a new product in a new market, so the business has experience of neither.'),
    cls('c51a', '1.3', 'Ansoff: a Spanish fashion chain opens its existing stores in Vietnam.', ANS, 'Market development', 'Existing product, new market.'),
    cls('c51b', '1.3', 'Ansoff: a crisp manufacturer launches a new flavour to its current customers.', ANS, 'Product development', 'New product, existing market.'),
    cls('c51c', '1.3', 'Ansoff: a gym offers a loyalty discount to existing members for the same membership.', ANS, 'Market penetration', 'Existing product, existing market.'),
    cls('c51d', '1.3', 'Ansoff: a phone manufacturer starts selling car insurance.', ANS, 'Diversification', 'New product, new market.'),
    // 1.4
    mc('m54', '1.4', 'A stakeholder is…', ['only a shareholder', 'an individual or group with an interest in, and affected by, the activities of a business', 'a supplier of finance', 'a member of the board'], 1, 'Shareholders are just one kind of stakeholder.'),
    mc('m55', '1.4', 'Which is an internal stakeholder?', ['Suppliers', 'Employees', 'The government', 'The local community'], 1, 'Internal stakeholders are members of the organisation: employees, managers, directors, shareholders.'),
    mc('m56', '1.4', 'Which is an external stakeholder?', ['Managers', 'Directors', 'A pressure group', 'Employees'], 2, 'Pressure groups are outside the organisation.'),
    mc('m57', '1.4', 'A business automates its warehouse. Which conflict is most likely?', ['Shareholders want lower costs; employees want job security', 'Customers want higher prices', 'Suppliers want smaller orders', 'The government wants less tax'], 0, 'Automation raises long-run profit but means redundancies.'),
    mc('m58', '1.4', 'Why can customers and shareholders conflict?', ['Customers want low prices and quality; shareholders want high profit', 'Customers own the business', 'Shareholders want lower dividends', 'They never conflict'], 0, 'Lower prices or better quality reduce margins, and so profit.'),
    mc('m59', '1.4', 'Stakeholder interests overlap when…', ['the business closes', 'the business succeeds and several groups benefit at once', 'prices rise', 'wages are cut'], 1, 'Growth can bring profit, job security, bigger orders and more tax at the same time.'),
    cls('c63a', '1.4', 'Power–interest grid: low power, low interest. Strategy?', GRID, 'Monitor (minimal effort)', 'Little effort is needed.'),
    cls('c63b', '1.4', 'Power–interest grid: low power, high interest. Strategy?', GRID, 'Keep informed', 'They care but cannot block you, so communicate.'),
    cls('c63c', '1.4', 'Power–interest grid: high power, low interest. Strategy?', GRID, 'Keep satisfied', 'Meet their needs so they do not become opposed.'),
    cls('c63d', '1.4', 'Power–interest grid: high power, high interest. Strategy?', GRID, 'Key player: manage closely', 'Involve them in decisions.'),
    mc('m60', '1.4', 'Why must stakeholder maps be updated regularly?', ['Because power and interest change over time', 'Because the law requires it', 'Because shareholders change every day', 'They do not need updating'], 0, 'For example, a pressure group can gain power through social media.'),
    // 1.5
    mc('m69', '1.5', 'Economies of scale are…', ['cost advantages from growing, so average cost per unit falls', 'higher total costs from growing', 'government subsidies to large firms', 'discounts for customers'], 0, 'The key idea is a falling average cost as scale increases.'),
    mc('m70', '1.5', 'Bulk-buying discounts are which internal economy of scale?', ['Technical', 'Purchasing', 'Financial', 'Managerial'], 1, 'Purchasing economies come from buying in large quantities.'),
    mc('m71', '1.5', 'Which is an external economy of scale?', ['Bulk buying', 'Cheaper bank loans for a big firm', 'A skilled local workforce from many similar firms in one area', 'Hiring specialist managers'], 2, 'External economies come from the growth of the industry or area and benefit all firms in it.'),
    mc('m72', '1.5', 'Which is a diseconomy of scale?', ['Bulk-buying discounts', 'Communication problems in a large organisation', 'Cheaper finance', 'Spreading advertising costs'], 1, 'Diseconomies push average cost up: communication, coordination and motivation problems.'),
    mc('m73', '1.5', 'Organic growth means…', ['buying another company', 'growing using the business’s own resources, e.g. opening new stores', 'merging with a rival', 'franchising'], 1, 'It is slower but lower risk, and control is kept.'),
    mc('m74', '1.5', 'A hostile acquisition, where the target’s management does not agree, is a…', ['merger', 'takeover', 'joint venture', 'strategic alliance'], 1, 'Merger = agreed combination into a new company. Takeover = hostile.'),
    mc('m75', '1.5', 'A joint venture differs from a strategic alliance because a joint venture…', ['creates a new, separate business entity', 'is always between rivals', 'involves no shared costs', 'is a type of franchise'], 0, 'In an alliance the firms cooperate but stay independent, with no new entity.'),
    mc('m76', '1.5', 'A franchisor earns money from franchisees mainly through…', ['dividends', 'initial fees and ongoing royalties', 'government grants', 'bank loans'], 1, 'Franchisees fund the outlets and pay fees and royalties.'),
    cls('c70a', '1.5', 'Fixed or variable? Rent of a warehouse', FV, 'Fixed', 'It does not change with output.'),
    cls('c70b', '1.5', 'Fixed or variable? Packaging', FV, 'Variable', 'More output needs more packaging.'),
    cls('c70c', '1.5', 'Fixed or variable? Interest on a bank loan', FV, 'Fixed', 'It does not depend on output.'),
    cls('c70d', '1.5', 'Fixed or variable? Piece-rate wages', FV, 'Variable', 'They are paid per unit produced.'),
    cls('c70e', '1.5', 'Fixed or variable? Insurance premium', FV, 'Fixed', 'It does not change with output.'),
    cls('c70f', '1.5', 'Fixed or variable? Raw materials', FV, 'Variable', 'They rise with output.'),
    cls('c80a', '1.5', 'Type of integration: a brewery buys a hop farm.', INTEG, 'Backward vertical', 'It moves back towards the supplier of its inputs.'),
    cls('c80b', '1.5', 'Type of integration: a car manufacturer buys a rival car manufacturer.', INTEG, 'Horizontal', 'Same industry, same stage of production.'),
    cls('c80c', '1.5', 'Type of integration: a film studio buys a cinema chain.', INTEG, 'Forward vertical', 'It moves forward towards the customer.'),
    cls('c80d', '1.5', 'Type of integration: a food company buys a cosmetics brand.', INTEG, 'Conglomerate', 'An unrelated industry (diversification).'),
    // 1.6
    mc('m88', '1.6', 'A multinational company (MNC) is a business that…', ['exports to many countries', 'has its headquarters in one country and operates (produces or provides services) in more than one', 'is owned by several governments', 'sells online worldwide'], 1, 'Exporting alone, however widely, does not make a business multinational.'),
    mc('m89', '1.6', 'Globalisation is…', ['the growing integration and interdependence of the world’s economies', 'a ban on foreign trade', 'one world currency', 'the growth of the public sector'], 0, 'It works through trade, flows of capital and people, and the spread of technology and culture.'),
    mc('m90', '1.6', 'Why might a host government offer tax incentives to an MNC?', ['To reduce competition', 'To gain jobs, foreign direct investment and technology transfer', 'To raise prices', 'Because the law requires it'], 1, 'It expects benefits greater than the tax revenue it gives up.'),
    mc('m91', '1.6', 'Which is a disadvantage of an MNC for a host country?', ['Job creation', 'Transfer of skills', 'Profits may be repatriated to the home country', 'More consumer choice'], 2, 'The other three are advantages.'),
    mc('m92', '1.6', 'A “footloose” MNC is one that…', ['can easily relocate to another country', 'has no headquarters', 'uses only local workers', 'pays no tax'], 0, 'This makes the jobs it creates less secure for the host country.'),
    mc('m93', '1.6', 'MNCs may avoid tax in host countries by…', ['transfer pricing', 'hiring local staff', 'paying dividends', 'franchising'], 0, 'Transfer pricing books profits where taxes are lowest.'),
    mc('m94', '1.6', 'Which is an opportunity that globalisation creates for domestic businesses?', ['More foreign competition', 'Access to larger foreign markets', 'Loss of market share', 'Price wars'], 1, 'The others are threats.'),
    mc('m95', '1.6', 'Which is a reason for the growth of MNCs?', ['Higher trade barriers', 'Improved communications and transport', 'Stricter capital controls', 'Rising transport costs'], 1, 'Others include falling trade barriers, deregulation of finance and economies of scale.'),
  ];

  /* ---------- number generators ---------- */
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function money(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function fmt(n) { return n.toLocaleString('en-US'); }

  const GENS = [
    { id: 'g-av', sub: '1.1', make: function () {
      const c = rnd(3, 30) * 0.1, p = rnd(c * 10 + 10, 60) * 0.1;
      const cc = Math.round(c * 100) / 100, pp = Math.round(p * 100) / 100, av = Math.round((pp - cc) * 100) / 100;
      return { q: 'A street stall buys ingredients and a cup for ' + money(cc) + ' per drink and sells each drink for ' + money(pp) + '. Calculate the added value per drink.', a: av, unit: '$',
        steps: ['Added value = selling price − cost of bought-in inputs', '= ' + money(pp) + ' − ' + money(cc) + ' = <b>' + money(av) + '</b>'] };
    } },
    { id: 'g-dps', sub: '1.2', make: function () {
      const profit = rnd(4, 40) * 100000, pct = pick([20, 25, 30, 40, 50, 60]), shares = pick([100000, 200000, 250000, 400000, 500000, 800000]);
      const total = profit * pct / 100, dps = Math.round(total / shares * 100) / 100;
      return { q: 'A company made a profit after tax of ' + money(profit) + '. The board pays ' + pct + '% of this as dividends. There are ' + fmt(shares) + ' shares. Calculate the dividend per share.', a: dps, unit: '$',
        steps: ['Total dividends = ' + pct + '% × ' + money(profit) + ' = ' + money(total), 'Dividend per share = ' + money(total) + ' ÷ ' + fmt(shares) + ' = <b>' + money(dps) + '</b>'] };
    } },
    { id: 'g-own', sub: '1.2', make: function () {
      const profit = rnd(5, 30) * 100000, pct = pick([25, 40, 50]), own = pick([2, 4, 5, 10, 20]);
      const total = profit * pct / 100, mine = total * own / 100;
      return { q: 'A company made a profit after tax of ' + money(profit) + ' and pays ' + pct + '% of it as dividends. Ana owns ' + own + '% of the shares. Calculate Ana’s total dividend.', a: mine, unit: '$',
        steps: ['Total dividends = ' + pct + '% × ' + money(profit) + ' = ' + money(total), 'Ana’s dividend = ' + own + '% × ' + money(total) + ' = <b>' + money(mine) + '</b>'] };
    } },
    { id: 'g-tc', sub: '1.5', make: function () {
      const fc = rnd(2, 30) * 1000, vc = rnd(2, 12), q = pick([200, 500, 1000, 2000, 2500, 4000, 5000]);
      const tc = fc + vc * q;
      return { q: 'A workshop has fixed costs of ' + money(fc) + ' per month and variable costs of ' + money(vc) + ' per unit. Calculate the total cost of producing ' + fmt(q) + ' units.', a: tc, unit: '$',
        steps: ['TC = FC + (VC per unit × output)', '= ' + money(fc) + ' + (' + vc + ' × ' + fmt(q) + ') = <b>' + money(tc) + '</b>'] };
    } },
    { id: 'g-ac', sub: '1.5', make: function () {
      const q = pick([500, 1000, 2000, 4000, 5000]), fc = rnd(1, 20) * 1000, vc = rnd(1, 9);
      const tc = fc + vc * q, ac = Math.round(tc / q * 100) / 100;
      return { q: 'Fixed costs are ' + money(fc) + ' and variable costs are ' + money(vc) + ' per unit. Calculate the average cost per unit at an output of ' + fmt(q) + ' units.', a: ac, unit: '$',
        steps: ['TC = ' + money(fc) + ' + (' + vc + ' × ' + fmt(q) + ') = ' + money(tc), 'AC = TC ÷ output = ' + money(tc) + ' ÷ ' + fmt(q) + ' = <b>' + money(ac) + '</b>'] };
    } },
    { id: 'g-ev', sub: '1.5', hl: true, make: function () {
      const p = pick([0.5, 0.6, 0.7, 0.75, 0.8, 0.9]), win = rnd(10, 40) * 10000, lose = rnd(0, 8) * 10000, cost = rnd(2, 12) * 10000;
      const ev = Math.round(p * win + (1 - p) * lose), net = ev - cost, q2 = Math.round((1 - p) * 100) / 100;
      return { q: '[HL] An option costs ' + money(cost) + '. It has a ' + p + ' probability of returning ' + money(win) + ' and a ' + q2 + ' probability of returning ' + money(lose) + '. Calculate the net expected value.', a: net, unit: '$',
        steps: ['EV = ' + p + ' × ' + money(win) + ' + ' + q2 + ' × ' + money(lose) + ' = ' + money(ev), 'Net EV = EV − cost = ' + money(ev) + ' − ' + money(cost) + ' = <b>' + money(net) + '</b>'] };
    } },
  ];

  window.QUICK = { items: ITEMS, gens: GENS };
})();
