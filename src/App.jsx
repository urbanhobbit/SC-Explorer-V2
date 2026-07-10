import {useEffect, useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {ComposableMap, Geographies, Geography, Marker} from 'react-simple-maps';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ExternalLink,
  Info,
  MessageCircle,
  RotateCcw,
  Shuffle,
  X,
} from 'lucide-react';
import DATA from './data/gameData.json';
import worldTopology from 'world-atlas/countries-110m.json';

const DOMAIN_META = {
  Citizenship: {letter: 'C', color: '#1769aa'},
  'the Relationship between Citizen and State': {letter: 'R', color: '#34745a'},
  Legitimacy: {letter: 'L', color: '#a33a46'},
  'Social Cohesion': {letter: 'S', color: '#76549a'},
  Fairness: {letter: 'F', color: '#b77413'},
  'Resilience to Crises': {letter: 'X', color: '#177985'},
};

const COUNTRY_COORDS = {
  IE: [-8.0, 53.3], PT: [-8.2, 39.6], ES: [-3.7, 40.3], FR: [2.4, 46.6], BE: [4.5, 50.6],
  NL: [5.3, 52.2], LU: [6.1, 49.75], DE: [10.3, 51.2], DK: [10.0, 56.1], SE: [16.5, 62.0],
  FI: [26.0, 64.5], EE: [25.5, 58.7], LV: [24.7, 56.9], LT: [23.9, 55.2], PL: [19.4, 52.1],
  CZ: [15.4, 49.9], AT: [14.4, 47.5], SI: [14.8, 46.1], HR: [16.0, 45.3], IT: [12.6, 42.9],
  MT: [14.4, 35.95], SK: [19.5, 48.7], HU: [19.4, 47.2], RO: [24.9, 45.9], BG: [25.3, 42.7],
  EL: [22.0, 39.2], CY: [33.3, 35.1],
};

const EU27_NUMERIC_TO_CODE = {
  40: 'AT', 56: 'BE', 100: 'BG', 191: 'HR', 196: 'CY', 203: 'CZ', 208: 'DK', 233: 'EE',
  246: 'FI', 250: 'FR', 276: 'DE', 300: 'EL', 348: 'HU', 372: 'IE', 380: 'IT', 428: 'LV',
  440: 'LT', 442: 'LU', 470: 'MT', 528: 'NL', 616: 'PL', 620: 'PT', 642: 'RO', 703: 'SK',
  705: 'SI', 724: 'ES', 752: 'SE',
};

const RANK_BANDS = [
  {id: 'top', short: 'Top 5', min: 1, max: 5},
  {id: 'upper', short: '6-10', min: 6, max: 10},
  {id: 'middle', short: '11-17', min: 11, max: 17},
  {id: 'lower', short: '18-22', min: 18, max: 22},
  {id: 'bottom', short: 'Bottom 5', min: 23, max: 27},
];

const STEPS = ['Country', 'Rank', 'Domains', 'Reveal', 'Evidence'];

const FEEDBACK_URL = 'https://github.com/urbanhobbit/SC-Explorer-V2/issues/new?'
  + `title=${encodeURIComponent('Prototype feedback')}`
  + `&body=${encodeURIComponent('What did you try?\n\nWhat felt unclear or broken?\n\nWhat would make the game better?')}`;

const SUBDOMAIN_LABELS = {
  'Respect fo Values- EU ': 'Respect for EU values',
  'Trust-Domestic': 'Trust in domestic institutions',
  'Trust-EU': 'Trust in EU institutions',
  'Trust-International': 'Trust in international institutions',
  'Justice&Law': 'Justice and rule of law',
  'COVID19': 'COVID-19 response',
  'EU Response': 'Awareness of EU response',
  "EU Response's Effectiveness": 'Effectiveness of EU response',
};

const domainMeta = (domain) => DOMAIN_META[domain];
const country = (code) => DATA.countries.find((item) => item.code === code);
const midpoint = (bandId) => {
  const band = RANK_BANDS.find((item) => item.id === bandId);
  return (band.min + band.max) / 2;
};
const bandForRank = (rank) => RANK_BANDS.find((band) => rank >= band.min && rank <= band.max);
const rankStrength = (rank) => (28 - rank) / 27;
const percent = (value) => Math.round(value * 100);
const subdomainLabel = (value) => SUBDOMAIN_LABELS[value] || value;
const rankToBandId = (rank) => bandForRank(rank)?.id || 'middle';
const hashString = (value) => [...value].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
const comparisonCountries = (selectedCountry, domain) => DATA.countries
  .filter((item) => item.code !== selectedCountry.code)
  .map((item) => ({
    country: item,
    rank: item.domains[domain].rank,
    order: Math.abs(hashString(`${selectedCountry.code}-${domain}-${item.code}`)),
  }))
  .sort((a, b) => a.order - b.order)
  .slice(0, 5)
  .concat([{country: selectedCountry, rank: selectedCountry.domains[domain].rank, selected: true}])
  .sort((a, b) => a.rank - b.rank);
function scoreBand(bandId, rank) {
  const band = RANK_BANDS.find((item) => item.id === bandId);
  const distance = rank < band.min ? band.min - rank : rank > band.max ? rank - band.max : 0;
  return Math.max(10, 100 - distance * 12);
}

function strongestDomain(selectedCountry) {
  return DATA.domainOrder
    .map((domain) => ({domain, ...selectedCountry.domains[domain]}))
    .sort((a, b) => b.score - a.score)[0];
}

function biggestGap(selectedCountry) {
  return DATA.domainOrder
    .map((domain) => ({
      domain,
      score: selectedCountry.domains[domain].score,
      delta: selectedCountry.domains[domain].score - DATA.euSummary[domain],
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
}

function evidenceFor(selectedCountry, domain) {
  const groups = DATA.indicatorRaw[domain] || {};
  return Object.entries(groups)
    .flatMap(([subdomain, indicators]) => indicators.map((item) => ({
      ...item,
      subdomain,
      value: item.values?.[selectedCountry.code],
    })))
    .filter((item) => Number.isFinite(item.value) && Number.isFinite(item.eu))
    .sort((a, b) => Math.abs(b.value - b.eu) - Math.abs(a.value - a.eu))
    .slice(0, 3);
}

const SESSION_KEY = 'sc-explorer-session-v1';
const SCREENS = ['intro', 'country', 'overall', 'predict', 'reveal', 'evidence'];

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !SCREENS.includes(session.screen)) return null;
    if (session.countryCode && !country(session.countryCode)) return null;
    return session;
  } catch {
    return null;
  }
}

const initialSession = loadSession();

function App() {
  const [screen, setScreen] = useState(initialSession?.screen || 'intro');
  const [countryCode, setCountryCode] = useState(initialSession?.countryCode || null);
  const [overallGuess, setOverallGuess] = useState(initialSession?.overallGuess ?? 14);
  const [predictions, setPredictions] = useState(() => initialSession?.predictions || Object.fromEntries(
    DATA.domainOrder.map((domain) => [domain, 14]),
  ));
  const [currentDomainIndex, setCurrentDomainIndex] = useState(initialSession?.currentDomainIndex || 0);
  const [focusDomain, setFocusDomain] = useState(initialSession?.focusDomain || null);
  const [visitedDomains, setVisitedDomains] = useState(initialSession?.visitedDomains || []);
  const [comparisonPicks, setComparisonPicks] = useState(() => initialSession?.comparisonPicks || {});
  const [methodOpen, setMethodOpen] = useState(false);

  const selectedCountry = countryCode ? country(countryCode) : null;
  const activeStep = screen === 'intro' ? -1 : screen === 'country' ? 0 : screen === 'overall' ? 1 : screen === 'predict' ? 2 : screen === 'reveal' ? 3 : 4;
  const results = useMemo(() => {
    if (!selectedCountry) return null;
    const overallPoints = Math.max(10, Math.round(100 - Math.abs(overallGuess - selectedCountry.composite.rank) * 3.85));
    const domains = DATA.domainOrder.map((domain) => {
      const comparisonWinner = comparisonCountries(selectedCountry, domain)[0].country.code;
      const pick = comparisonPicks[domain];
      const comparisonPoints = !pick ? 0 : pick === comparisonWinner ? 100 : 25;
      return {
        domain,
        points: Math.max(10, Math.round(100 - Math.abs(predictions[domain] - selectedCountry.domains[domain].rank) * 4)),
        error: Math.abs(predictions[domain] - selectedCountry.domains[domain].rank),
        comparisonPoints,
        comparisonCorrect: pick ? pick === comparisonWinner : null,
      };
    });
    const total = overallPoints + domains.reduce((sum, item) => sum + item.points + item.comparisonPoints, 0);
    return {overallPoints, domains, total, accuracy: Math.round((total / 1300) * 100)};
  }, [overallGuess, predictions, comparisonPicks, selectedCountry]);

  useEffect(() => {
    window.scrollTo({top: 0, behavior: 'instant'});
  }, [screen]);

  useEffect(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        screen, countryCode, overallGuess, predictions, currentDomainIndex, focusDomain, visitedDomains, comparisonPicks,
      }));
    } catch {
      // storage unavailable (private mode / quota) — session simply won't resume
    }
  }, [screen, countryCode, overallGuess, predictions, currentDomainIndex, focusDomain, visitedDomains, comparisonPicks]);

  const begin = () => {
    setOverallGuess(14);
    setPredictions(Object.fromEntries(DATA.domainOrder.map((domain) => [domain, 14])));
    setCurrentDomainIndex(0);
    setFocusDomain(null);
    setVisitedDomains([]);
    setComparisonPicks({});
    setScreen('overall');
  };

  const surprise = () => {
    const next = DATA.countries[Math.floor(Math.random() * DATA.countries.length)];
    setCountryCode(next.code);
  };

  const reset = () => {
    setCountryCode(null);
    setFocusDomain(null);
    setCurrentDomainIndex(0);
    setVisitedDomains([]);
    setComparisonPicks({});
    setScreen('country');
  };

  const markVisited = (domain) => setVisitedDomains((current) => (
    current.includes(domain) ? current : [...current, domain]
  ));

  const activeScreenContent = (() => {
    if (screen === 'intro') {
      return <IntroScreen key="intro" onBegin={() => setScreen('country')} />;
    }
    if (screen === 'country') {
      return (
        <CountryScreen
          key="country"
          countryCode={countryCode}
          setCountryCode={setCountryCode}
          selectedCountry={selectedCountry}
          onSurprise={surprise}
          onBegin={begin}
        />
      );
    }
    if (screen === 'overall' && selectedCountry) {
      return (
        <OverallScreen
          key="overall"
          selectedCountry={selectedCountry}
          overallGuess={overallGuess}
          setOverallGuess={setOverallGuess}
          onBack={() => setScreen('country')}
          onNext={() => setScreen('predict')}
        />
      );
    }
    if (screen === 'predict' && selectedCountry) {
      return (
        <PredictionScreen
          key="predict"
          selectedCountry={selectedCountry}
          predictions={predictions}
          setPredictions={setPredictions}
          comparisonPicks={comparisonPicks}
          setComparisonPicks={setComparisonPicks}
          currentDomainIndex={currentDomainIndex}
          setCurrentDomainIndex={setCurrentDomainIndex}
          onBack={() => setScreen('overall')}
          onCountry={() => setScreen('country')}
          onReveal={() => { setFocusDomain(null); setScreen('reveal'); }}
        />
      );
    }
    if (screen === 'reveal' && selectedCountry) {
      return (
        <RevealScreen
          key="reveal"
          selectedCountry={selectedCountry}
          overallGuess={overallGuess}
          predictions={predictions}
          results={results}
          focusDomain={focusDomain}
          setFocusDomain={setFocusDomain}
          visitedDomains={visitedDomains}
          onEvidence={(domain) => { markVisited(domain); setScreen('evidence'); }}
        />
      );
    }
    if (screen === 'evidence' && selectedCountry && focusDomain) {
      return (
        <EvidenceScreen
          key="evidence"
          selectedCountry={selectedCountry}
          domain={focusDomain}
          accuracy={results.accuracy}
          onBack={() => setScreen('reveal')}
          onReset={reset}
          onMethod={() => setMethodOpen(true)}
        />
      );
    }
    return null;
  })();
  return (
    <div className="app-shell">
      <Header activeStep={activeStep} score={screen === 'intro' || screen === 'country' || screen === 'overall' || screen === 'predict' ? null : results?.accuracy} onMethod={() => setMethodOpen(true)} onHome={() => setScreen('intro')} />
      <main>
        <AnimatePresence mode="wait">{activeScreenContent}</AnimatePresence>
      </main>
      <AnimatePresence>{methodOpen && <MethodModal onClose={() => setMethodOpen(false)} />}</AnimatePresence>
      <a className="feedback-fab" href={FEEDBACK_URL} target="_blank" rel="noreferrer">
        <MessageCircle size={16} /> <span>Feedback</span>
      </a>
      <a className="co3-badge" href="https://www.co3socialcontract.eu/" target="_blank" rel="noreferrer">
        <ExternalLink size={14} /> <span>Part of the CO3 project</span>
      </a>
    </div>
  );
}

function Header({activeStep, score, onMethod, onHome}) {
  return (
    <header className="site-header">
      <button className="brand-lockup" type="button" onClick={onHome} aria-label="Back to start">
        <span className="brand-mark">SC</span>
        <div><b>Social Contract</b><span>Explorer</span></div>
      </button>
      <nav className="step-nav" aria-label="Game progress">
        {STEPS.map((step, index) => (
          <span key={step} className={index === activeStep ? 'active' : index < activeStep ? 'done' : ''}>
            <i>{index + 1}</i>{step}
          </span>
        ))}
      </nav>
      <div className="header-actions">
        {score !== null && <span className="score-readout"><b>{score}%</b> read</span>}
        <button className="icon-button" type="button" onClick={onMethod} aria-label="Open methodology" title="Methodology">
          <Info size={18} />
        </button>
      </div>
    </header>
  );
}

function Screen({children, className = ''}) {
  return (
    <motion.section
      className={`screen ${className}`}
      initial={{opacity: 0, y: 16}}
      animate={{opacity: 1, y: 0}}
      exit={{opacity: 0, y: -10}}
      transition={{duration: 0.28, ease: 'easeOut'}}
    >
      {children}
    </motion.section>
  );
}

function EuropeMap({countryCode, setCountryCode}) {
  return (
    <ComposableMap
      className="atlas-svg"
      projection="geoMercator"
      projectionConfig={{scale: 700, center: [15, 53]}}
      width={700}
      height={650}
      role="img"
      aria-hidden="true"
    >
      <Geographies geography={worldTopology}>
        {({geographies}) => geographies.map((geo) => {
          const isMember = Boolean(EU27_NUMERIC_TO_CODE[Number(geo.id)]);
          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              className={isMember ? 'atlas-country member' : 'atlas-country'}
              tabIndex={-1}
            />
          );
        })}
      </Geographies>
      {DATA.countries.map((item) => {
        const coordinates = COUNTRY_COORDS[item.code];
        if (!coordinates) return null;
        return (
          <Marker key={item.code} coordinates={coordinates}>
            <foreignObject x={-16} y={-13} width={32} height={26} style={{overflow: 'visible'}}>
              <div xmlns="http://www.w3.org/1999/xhtml" className="marker-host">
                <button
                  type="button"
                  className={`country-point ${countryCode === item.code ? 'selected' : ''}`}
                  title={item.name}
                  aria-label={item.name}
                  aria-pressed={countryCode === item.code}
                  onClick={() => setCountryCode(item.code)}
                >
                  {item.code}
                </button>
              </div>
            </foreignObject>
          </Marker>
        );
      })}
    </ComposableMap>
  );
}
function IntroScreen({onBegin}) {
  return (
    <Screen className="intro-screen">
      <div className="screen-heading intro-heading">
        <p className="eyebrow">CO3 project</p>
        <h1>What holds a society together?</h1>
        <p>A social contract is the bargain that makes political life possible: citizens accept rules, taxes, rights and duties, and public authority, while expecting protection, voice, fairness, recognition and mutual responsibility in return.</p>
        <p>This explorer turns that bargain into six measurable domains, built from more than 150 Eurobarometer indicators across the EU27.</p>
      </div>
      <a className="co3-note" href="https://www.co3socialcontract.eu/" target="_blank" rel="noreferrer">
        <b>What is CO3?</b>
        <p>CO3 is a Horizon Europe research project studying resilient social contracts for democratic societies across Europe. This explorer is one of its public tools.</p>
        <span>co3socialcontract.eu <ExternalLink size={13} /></span>
      </a>
      <div className="domain-preview-grid">
        {DATA.domainOrder.map((domain) => {
          const meta = domainMeta(domain);
          return (
            <div key={domain} className="domain-preview-card" style={{'--domain-color': meta.color}}>
              <span className="domain-token small">{meta.letter}</span>
              <div>
                <b>{DATA.domainDisplay[domain]}</b>
                <p>{DATA.domainShort[domain]}</p>
              </div>
            </div>
          );
        })}
      </div>
      <button className="primary-button seal" type="button" onClick={onBegin}>
        Choose your country <ArrowRight size={18} />
      </button>
    </Screen>
  );
}
function CountryScreen({countryCode, setCountryCode, selectedCountry, onSurprise, onBegin}) {
  return (
    <Screen className="country-screen">
      <div className="screen-heading country-heading">
        <p className="eyebrow">EU27 perception game</p>
        <h1>Choose a country.<br />Draw its social contract.</h1>
        <p>Test what you expect against more than 150 Eurobarometer indicators.</p>
      </div>
      <div className="map-stage" aria-label="Choose an EU member state">
        <EuropeMap countryCode={countryCode} setCountryCode={setCountryCode} />
      </div>
      <div className="country-dock">
        <div className="selected-country" aria-live="polite">
          <span>{selectedCountry ? selectedCountry.code : '--'}</span>
          <div><small>Selected country</small><b>{selectedCountry?.name || 'Choose from the map'}</b></div>
        </div>
        <button className="text-button" type="button" onClick={onSurprise}><Shuffle size={16} /> Surprise me</button>
        <button className="primary-button" type="button" disabled={!selectedCountry} onClick={onBegin}>
          Draw the profile <ArrowRight size={18} />
        </button>
      </div>
    </Screen>
  );
}

function OverallScreen({selectedCountry, overallGuess, setOverallGuess, onBack, onNext}) {
  return (
    <Screen className="overall-screen">
      <div className="screen-toolbar">
        <button className="text-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Country</button>
        <span className="country-tag">{selectedCountry.code} / overall rank</span>
      </div>
      <div className="overall-stage">
        <div className="screen-heading compact">
          <p className="eyebrow">First instinct</p>
          <h1>Place {selectedCountry.name} on the overall index.</h1>
          <p>One quick baseline before the six domain rounds.</p>
        </div>
        <div className="overall-card">
          <div className="rank-number">
            <small>Your overall rank</small>
            <strong>#{overallGuess}</strong>
            <span>of 27 EU countries</span>
          </div>
          <input
            type="range"
            min="1"
            max="27"
            value={overallGuess}
            aria-label="Predicted overall rank"
            onChange={(event) => setOverallGuess(Number(event.target.value))}
          />
          <div className="range-labels"><span>#1 highest</span><span>#27 lowest</span></div>
          <button className="primary-button seal" type="button" onClick={onNext}>Start domain rounds <ArrowRight size={18} /></button>
        </div>
      </div>
    </Screen>
  );
}
function PredictionScreen({
  selectedCountry,
  predictions,
  setPredictions,
  comparisonPicks,
  setComparisonPicks,
  currentDomainIndex,
  setCurrentDomainIndex,
  onBack,
  onCountry,
  onReveal,
}) {
  const domain = DATA.domainOrder[currentDomainIndex];
  const meta = domainMeta(domain);
  const deepDive = DATA.domainDeepDive[domain];
  const selectedRank = predictions[domain];
  const [checkedDomains, setCheckedDomains] = useState({});
  const checked = Boolean(checkedDomains[domain]);
  const details = selectedCountry.domains[domain];
  const guessedBand = bandForRank(selectedRank);
  const actualBand = bandForRank(details.rank);
  const matched = guessedBand.id === actualBand.id;
  const comparisons = comparisonCountries(selectedCountry, domain);
  const comparisonWinner = comparisons[0];
  const comparisonPick = comparisonPicks[domain];
  const comparisonRevealed = Boolean(comparisonPick);
  const comparisonMatched = comparisonPick === comparisonWinner.country.code;
  const isFirst = currentDomainIndex === 0;
  const isLast = currentDomainIndex === DATA.domainOrder.length - 1;
  const goNext = () => {
    if (!checked) {
      setCheckedDomains((current) => ({...current, [domain]: true}));
      return;
    }
    if (!comparisonRevealed) return;
    if (isLast) {
      onReveal();
      return;
    }
    setCurrentDomainIndex((index) => index + 1);
  };

  return (
    <Screen className="prediction-screen">
      <div className="screen-toolbar">
        <button className="text-button" type="button" onClick={onCountry}><ArrowLeft size={16} /> Country</button>
        <span className="country-tag">{selectedCountry.code} / domain {currentDomainIndex + 1} of {DATA.domainOrder.length}</span>
      </div>
      <div className="domain-round-heading" style={{'--domain-color': meta.color}}>
        <span className="domain-token">{meta.letter}</span>
        <div>
          <p className="eyebrow">Domain round</p>
          <h1>{DATA.domainDisplay[domain]}</h1>
          <p>{DATA.domainKeyQuestion[domain]}</p>
        </div>
      </div>
      <div className="round-layout decision-first">
        <section className="round-prediction primary">
          <div className="single-band rank-slider-panel">
            <small>Your prediction</small>
            <h2>Where does {selectedCountry.name} rank here?</h2>
            <div className="domain-rank-slider">
              <strong>#{selectedRank}</strong>
              <input
                type="range"
                min="1"
                max="27"
                value={selectedRank}
                aria-label={`${DATA.domainDisplay[domain]} predicted rank`}
                onChange={(event) => setPredictions((current) => ({...current, [domain]: Number(event.target.value)}))}
              />
              <div className="range-labels"><span>#1 highest</span><span>#27 lowest</span></div>
              <span className="band-note">{guessedBand.short}</span>
            </div>
            <AnimatePresence mode="wait">
              {checked && (
                <motion.div
                  className={`round-feedback ${matched ? 'match' : 'miss'}`}
                  key={domain}
                  initial={{opacity: 0, y: 10}}
                  animate={{opacity: 1, y: 0}}
                  exit={{opacity: 0, y: -8}}
                  transition={{duration: 0.22}}
                >
                  <small>{matched ? 'Good read' : 'Data check'}</small>
                  <strong>{selectedCountry.name} ranks #{details.rank}</strong>
                  <p>You placed it at <b>#{selectedRank}</b>; the measured band is <b>{actualBand.short}</b>.</p>
                  <div className="comparison-round">
                    <p className="comparison-prompt">Which of these six has the <b>highest</b> score here?</p>
                    <div className="comparison-strip" aria-label="Guess the highest score among six countries">
                      {comparisons.map((item) => {
                        const isWinner = item.country.code === comparisonWinner.country.code;
                        const isPick = comparisonPick === item.country.code;
                        return (
                          <button
                            type="button"
                            key={item.country.code}
                            disabled={comparisonRevealed}
                            className={[
                              item.selected ? 'selected' : '',
                              comparisonRevealed && isWinner ? 'winner' : '',
                              comparisonRevealed && isPick && !isWinner ? 'missed' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => setComparisonPicks((current) => ({...current, [domain]: item.country.code}))}
                          >
                            <span>{item.country.code}</span>
                            <b>{comparisonRevealed ? `#${item.rank}` : '?'}</b>
                          </button>
                        );
                      })}
                    </div>
                    {comparisonRevealed && (
                      <p className={`comparison-result ${comparisonMatched ? 'match' : 'miss'}`}>
                        {comparisonMatched ? 'Correct read.' : `${comparisonWinner.country.name} scores highest here.`}
                      </p>
                    )}
                  </div>
                  <dl>
                    <div><dt>Strongest subdomain</dt><dd>{subdomainLabel(details.topSubdomain)}</dd></div>
                    <div><dt>Weakest subdomain</dt><dd>{subdomainLabel(details.bottomSubdomain)}</dd></div>
                  </dl>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
        <aside className="theory-panel compact" style={{'--domain-color': meta.color}}>
          <small>Framework note</small>
          <p>{DATA.domainShort[domain]}</p>
          <details>
            <summary>Open theory notes</summary>
            <p>{deepDive.theory}</p>
            <ul>
              {deepDive.anchors.map((anchor) => <li key={anchor}>{anchor}</li>)}
            </ul>
          </details>
        </aside>
      </div>
      <div className="round-progress" aria-label="Domain round progress">
        {DATA.domainOrder.map((item, index) => (
          <button
            key={item}
            type="button"
            className={index === currentDomainIndex ? 'active' : index < currentDomainIndex ? 'done' : ''}
            style={{'--domain-color': domainMeta(item).color}}
            aria-label={`Go to ${DATA.domainDisplay[item]}`}
            onClick={() => setCurrentDomainIndex(index)}
          >
            {domainMeta(item).letter}
          </button>
        ))}
      </div>
      <div className="sticky-action">
        <button
          className="text-button"
          type="button"
          onClick={() => (isFirst ? onBack() : setCurrentDomainIndex((index) => Math.max(0, index - 1)))}
        >
          <ArrowLeft size={16} /> {isFirst ? 'Overall rank' : 'Previous domain'}
        </button>
        <button className="primary-button seal" type="button" disabled={checked && !comparisonRevealed} onClick={goNext}>
          {!checked ? 'Check this domain' : !comparisonRevealed ? 'Guess the highest score above' : isLast ? 'Reveal the profile' : 'Next domain'} <ArrowRight size={18} />
        </button>
      </div>
    </Screen>
  );
}
function ProfileRadar({selectedCountry, predictions}) {
  const size = 310;
  const center = size / 2;
  const radius = 105;
  const point = (index, strength) => {
    const angle = (Math.PI * 2 * index) / DATA.domainOrder.length - Math.PI / 2;
    return [center + radius * strength * Math.cos(angle), center + radius * strength * Math.sin(angle)];
  };
  const polygon = (valueFor) => DATA.domainOrder.map((domain, index) => point(index, valueFor(domain)).join(',')).join(' ');
  return (
    <svg className="profile-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Predicted and actual rank profile for ${selectedCountry.name}`}>
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <polygon key={level} points={polygon(() => level)} className="radar-grid" />
      ))}
      {DATA.domainOrder.map((domain, index) => {
        const [x, y] = point(index, 1);
        const [lx, ly] = point(index, 1.18);
        return <g key={domain}><line x1={center} y1={center} x2={x} y2={y} className="radar-axis" /><text x={lx} y={ly}>{domainMeta(domain).letter}</text></g>;
      })}
      <motion.polygon
        points={polygon((domain) => rankStrength(predictions[domain]))}
        className="radar-predicted"
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        transition={{delay: 0.2}}
      />
      <motion.polygon
        points={polygon((domain) => rankStrength(selectedCountry.domains[domain].rank))}
        className="radar-actual"
        initial={{opacity: 0, scale: 0.8, transformOrigin: 'center'}}
        animate={{opacity: 1, scale: 1}}
        transition={{delay: 0.45, duration: 0.5}}
      />
    </svg>
  );
}

function RevealScreen({selectedCountry, overallGuess, predictions, results, focusDomain, setFocusDomain, visitedDomains, onEvidence}) {
  const suggested = [...results.domains].sort((a, b) => b.error - a.error)[0].domain;
  const activeDomain = focusDomain || suggested;
  return (
    <Screen className="reveal-screen">
      <div className="reveal-intro">
        <div>
          <p className="eyebrow">The data answers</p>
          <h1>{selectedCountry.name}, as you imagined it and as measured.</h1>
          <p>Your overall guess was <b>#{overallGuess}</b>. The index places {selectedCountry.name} at <b>#{selectedCountry.composite.rank}</b> of 27.</p>
        </div>
        <div className="accuracy-stamp"><strong>{results.accuracy}%</strong><span>profile read</span></div>
      </div>
      <div className="reveal-grid">
        <div className="radar-panel">
          <ProfileRadar selectedCountry={selectedCountry} predictions={predictions} />
          <div className="chart-legend"><span className="predicted">Your profile</span><span className="actual">Measured profile</span></div>
          <p>Radar values show each domain's relative rank position among the EU27.</p>
        </div>
        <div className="rank-results">
          <div className="result-heading"><span>Domain</span><span>Your band</span><span>Actual</span></div>
          {DATA.domainOrder.map((domain, index) => {
            const meta = domainMeta(domain);
            const actualRank = selectedCountry.domains[domain].rank;
            const guessedBand = bandForRank(predictions[domain]);
            const selected = activeDomain === domain;
            return (
              <motion.button
                type="button"
                className={`result-row ${selected ? 'selected' : ''}`}
                key={domain}
                onClick={() => { setFocusDomain(domain); onEvidence(domain); }}
                initial={{opacity: 0, y: 8}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.25 + index * 0.055}}
              >
                <span className="result-domain">
                  <i style={{background: meta.color}}>{meta.letter}</i>
                  <b>{DATA.domainDisplay[domain]}</b>
                  {visitedDomains.includes(domain) && <Check size={14} className="visited-mark" aria-label="Evidence reviewed" />}
                </span>
                <span>#{predictions[domain]}</span>
                <span className={bandForRank(actualRank).id === guessedBand.id ? 'match' : ''}>#{actualRank}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="surprise-prompt">
        <div>
          <small>{visitedDomains.length === 0 ? 'Choose one finding to investigate' : `${visitedDomains.length} of ${DATA.domainOrder.length} domains reviewed`}</small>
          <b>{DATA.domainDisplay[activeDomain]}</b>
        </div>
        <button className="primary-button" type="button" onClick={() => { setFocusDomain(activeDomain); onEvidence(activeDomain); }}>
          See the evidence <BarChart3 size={18} />
        </button>
      </div>
    </Screen>
  );
}

function EvidenceScreen({selectedCountry, domain, accuracy, onBack, onReset, onMethod}) {
  const meta = domainMeta(domain);
  const details = selectedCountry.domains[domain];
  const indicators = evidenceFor(selectedCountry, domain);
  const strongest = strongestDomain(selectedCountry);
  const gap = biggestGap(selectedCountry);
  return (
    <Screen className="evidence-screen">
      <div className="screen-toolbar">
        <button className="text-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Profile</button>
        <span className="country-tag">{selectedCountry.code} / evidence</span>
      </div>
      <div className="evidence-hero" style={{'--domain-color': meta.color}}>
        <span className="evidence-letter">{meta.letter}</span>
        <div>
          <p className="eyebrow">A closer reading</p>
          <h1>{DATA.domainDisplay[domain]}</h1>
          <p>{DATA.domainKeyQuestion[domain]}</p>
        </div>
        <div className="domain-rank"><small>{selectedCountry.name}</small><strong>#{details.rank}</strong><span>of 27</span></div>
      </div>
      <div className="evidence-layout">
        <article className="evidence-story">
          <p className="lead-copy">{DATA.domainShort[domain]}</p>
          <div className="subdomain-pair">
            <div><small>Highest-scoring subdomain</small><b>{subdomainLabel(details.topSubdomain)}</b></div>
            <div><small>Lowest-scoring subdomain</small><b>{subdomainLabel(details.bottomSubdomain)}</b></div>
          </div>
          <h2>Three signals behind the profile</h2>
          <p className="section-note">Raw survey responses with the largest distance from the EU benchmark in this domain.</p>
          <div className="indicator-list">
            {indicators.map((item, index) => {
              const delta = item.value - item.eu;
              return (
                <motion.div className="indicator-row" key={`${item.subdomain}-${item.indicator}`} initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} transition={{delay: index * 0.1}}>
                  <div><small>{subdomainLabel(item.subdomain)}</small><b>{item.indicator}</b><span>{item.scale}</span></div>
                  <div className="indicator-values">
                    <strong>{item.value.toFixed(1)}</strong>
                    <span>EU {item.eu.toFixed(1)}</span>
                    <em className={delta >= 0 ? 'positive' : 'negative'}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}</em>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <button className="method-link" type="button" onClick={onMethod}><BookOpen size={17} /> How these signals become an index</button>
        </article>
        <aside className="session-summary">
          <p className="eyebrow">Session note</p>
          <strong>{accuracy}%</strong>
          <span>profile accuracy</span>
          <dl>
            <div><dt>Strongest domain</dt><dd>{DATA.domainDisplay[strongest.domain]}</dd></div>
            <div><dt>Largest EU27 gap</dt><dd>{DATA.domainDisplay[gap.domain]}<br />{Math.abs(Math.round(gap.delta * 100))} index points {gap.delta >= 0 ? 'above' : 'below'}</dd></div>
          </dl>
          <p className="caveat">These are comparative index positions, not a verdict on a country. Indicator direction and metadata remain part of the interpretation.</p>
          <button className="primary-button seal" type="button" onClick={onReset}><RotateCcw size={17} /> Read another country</button>
        </aside>
      </div>
    </Screen>
  );
}

function MethodModal({onClose}) {
  return (
    <motion.div className="modal-backdrop" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} onClick={onClose}>
      <motion.div className="method-modal" role="dialog" aria-modal="true" aria-labelledby="method-title" initial={{opacity: 0, y: 20, scale: 0.98}} animate={{opacity: 1, y: 0, scale: 1}} exit={{opacity: 0, y: 10}} onClick={(event) => event.stopPropagation()}>
        <button className="icon-button close" type="button" onClick={onClose} aria-label="Close methodology" title="Close"><X size={19} /></button>
        <p className="eyebrow">Methodology</p>
        <h2 id="method-title">From survey response to social contract profile</h2>
        <div className="method-flow" aria-label="Index construction flow">
          <span>150+ indicators</span><ArrowRight size={16} /><span>Subdomains</span><ArrowRight size={16} /><span>6 domains</span><ArrowRight size={16} /><span>Composite index</span>
        </div>
        <p>Indicators primarily come from Standard Eurobarometer waves between 2019 and 2024. Each raw indicator is min-max normalised across countries, excluding the EU27 aggregate.</p>
        <p>Indicators are averaged into subdomains, subdomains into domains, and domains into the composite index. A secondary min-max normalisation is applied at each aggregation level to retain a 0-1 comparative scale.</p>
        <div className="method-warning">
          <Info size={18} />
          <p>This research prototype currently treats higher indicator values as a stronger social-contract signal. Indicators whose conceptual direction is ambiguous require expert review before substantive interpretation.</p>
        </div>
        <div className="source-links">
          <a href="https://doi.org/10.5281/zenodo.20443724" target="_blank" rel="noreferrer">Read the framework <ExternalLink size={15} /></a>
          <a href="https://socialcontractindicators.org/" target="_blank" rel="noreferrer">Explore the full dashboard <ExternalLink size={15} /></a>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default App;
