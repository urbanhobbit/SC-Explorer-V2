import {useEffect, useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  ExternalLink,
  Info,
  RotateCcw,
  Shuffle,
  X,
} from 'lucide-react';
import DATA from './data/gameData.json';

const DOMAIN_META = {
  Citizenship: {letter: 'C', color: '#1769aa'},
  'the Relationship between Citizen and State': {letter: 'R', color: '#34745a'},
  Legitimacy: {letter: 'L', color: '#a33a46'},
  'Social Cohesion': {letter: 'S', color: '#76549a'},
  Fairness: {letter: 'F', color: '#b77413'},
  'Resilience to Crises': {letter: 'X', color: '#177985'},
};

const COUNTRY_POSITIONS = {
  IE: [14, 42], PT: [9, 78], ES: [17, 78], FR: [25, 57], BE: [31, 45],
  NL: [32, 37], LU: [33, 50], DE: [41, 47], DK: [43, 28], SE: [54, 18],
  FI: [69, 15], EE: [70, 30], LV: [70, 38], LT: [69, 46], PL: [56, 48],
  CZ: [47, 53], AT: [45, 62], SI: [47, 70], HR: [52, 75], IT: [39, 79],
  MT: [44, 94], SK: [55, 58], HU: [56, 66], RO: [66, 72], BG: [68, 82],
  EL: [62, 92], CY: [79, 94],
};

const RANK_BANDS = [
  {id: 'top', short: 'Top 5', min: 1, max: 5},
  {id: 'upper', short: '6-10', min: 6, max: 10},
  {id: 'middle', short: '11-17', min: 11, max: 17},
  {id: 'lower', short: '18-22', min: 18, max: 22},
  {id: 'bottom', short: 'Bottom 5', min: 23, max: 27},
];

const STEPS = ['Country', 'Rank', 'Domains', 'Reveal', 'Evidence'];

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

function App() {
  const [screen, setScreen] = useState('country');
  const [countryCode, setCountryCode] = useState(null);
  const [overallGuess, setOverallGuess] = useState(14);
  const [predictions, setPredictions] = useState(() => Object.fromEntries(
    DATA.domainOrder.map((domain) => [domain, 14]),
  ));
  const [currentDomainIndex, setCurrentDomainIndex] = useState(0);
  const [focusDomain, setFocusDomain] = useState(null);
  const [methodOpen, setMethodOpen] = useState(false);

  const selectedCountry = countryCode ? country(countryCode) : null;
  const activeStep = screen === 'country' ? 0 : screen === 'overall' ? 1 : screen === 'predict' ? 2 : screen === 'reveal' ? 3 : 4;
  const results = useMemo(() => {
    if (!selectedCountry) return null;
    const overallPoints = Math.max(10, Math.round(100 - Math.abs(overallGuess - selectedCountry.composite.rank) * 3.85));
    const domains = DATA.domainOrder.map((domain) => ({
      domain,
      points: Math.max(10, Math.round(100 - Math.abs(predictions[domain] - selectedCountry.domains[domain].rank) * 4)),
      error: Math.abs(predictions[domain] - selectedCountry.domains[domain].rank),
    }));
    const total = overallPoints + domains.reduce((sum, item) => sum + item.points, 0);
    return {overallPoints, domains, total, accuracy: Math.round((total / 700) * 100)};
  }, [overallGuess, predictions, selectedCountry]);

  useEffect(() => {
    window.scrollTo({top: 0, behavior: 'instant'});
  }, [screen]);

  const begin = () => {
    setOverallGuess(14);
    setPredictions(Object.fromEntries(DATA.domainOrder.map((domain) => [domain, 14])));
    setCurrentDomainIndex(0);
    setFocusDomain(null);
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
    setScreen('country');
  };

  const activeScreenContent = (() => {
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
          onEvidence={() => setScreen('evidence')}
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
      <Header activeStep={activeStep} score={screen === 'country' || screen === 'overall' || screen === 'predict' ? null : results?.accuracy} onMethod={() => setMethodOpen(true)} />
      <main>
        <AnimatePresence mode="wait">{activeScreenContent}</AnimatePresence>
      </main>
      <AnimatePresence>{methodOpen && <MethodModal onClose={() => setMethodOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function Header({activeStep, score, onMethod}) {
  return (
    <header className="site-header">
      <div className="brand-lockup">
        <span className="brand-mark">SC</span>
        <div><b>Social Contract</b><span>Explorer</span></div>
      </div>
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

function EuropeMapBackdrop() {
  return (
    <div className="atlas-field" aria-hidden="true">
      <span className="atlas-label north">Nordic edge</span>
      <span className="atlas-label west">Atlantic</span>
      <span className="atlas-label south">Mediterranean</span>
      <span className="atlas-label east">Eastern member states</span>
      <svg className="atlas-lines" viewBox="0 0 720 720">
        <path d="M96 182C188 105 298 80 426 112c116 29 183 96 202 188" />
        <path d="M92 352c92-51 186-72 282-62 108 11 190 56 246 133" />
        <path d="M134 546c86-35 167-46 244-34 82 13 151 47 208 103" />
        <path d="M220 116c-29 81-34 159-13 234 24 86 83 160 176 223" />
        <path d="M390 92c-23 95-23 185 0 270 22 84 66 156 133 216" />
        <path d="M552 153c-49 74-70 148-64 222 6 76 40 144 103 204" />
      </svg>
      <span className="atlas-title">EU27 selection field</span>
    </div>
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
        <EuropeMapBackdrop />
        {DATA.countries.map((item) => {
          const [x, y] = COUNTRY_POSITIONS[item.code] || [50, 50];
          return (
            <button
              key={item.code}
              type="button"
              className={`country-point ${countryCode === item.code ? 'selected' : ''}`}
              style={{'--x': `${x}%`, '--y': `${y}%`}}
              title={item.name}
              aria-label={item.name}
              aria-pressed={countryCode === item.code}
              onClick={() => setCountryCode(item.code)}
            >
              {item.code}
            </button>
          );
        })}
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
  const isFirst = currentDomainIndex === 0;
  const isLast = currentDomainIndex === DATA.domainOrder.length - 1;
  const goNext = () => {
    if (!checked) {
      setCheckedDomains((current) => ({...current, [domain]: true}));
      return;
    }
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
                  <div className="comparison-strip" aria-label="Comparison with five other countries">
                    {comparisons.map((item) => (
                      <div key={item.country.code} className={item.selected ? 'selected' : ''}>
                        <span>{item.country.code}</span>
                        <b>#{item.rank}</b>
                      </div>
                    ))}
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
        <button className="primary-button seal" type="button" onClick={goNext}>
          {!checked ? 'Check this domain' : isLast ? 'Reveal the profile' : 'Next domain'} <ArrowRight size={18} />
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

function RevealScreen({selectedCountry, overallGuess, predictions, results, focusDomain, setFocusDomain, onEvidence}) {
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
                onClick={() => setFocusDomain(domain)}
                initial={{opacity: 0, y: 8}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.25 + index * 0.055}}
              >
                <span className="result-domain"><i style={{background: meta.color}}>{meta.letter}</i><b>{DATA.domainDisplay[domain]}</b></span>
                <span>#{predictions[domain]}</span>
                <span className={bandForRank(actualRank).id === guessedBand.id ? 'match' : ''}>#{actualRank}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="surprise-prompt">
        <div><small>Choose one finding to investigate</small><b>{DATA.domainDisplay[activeDomain]}</b></div>
        <button className="primary-button" type="button" onClick={() => { setFocusDomain(activeDomain); onEvidence(); }}>
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
