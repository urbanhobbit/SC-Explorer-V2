# Social Contract Explorer v2

An evidence-led data game for testing assumptions about social contracts across the EU27.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Sources

- Emre Erdogan, Pinar Uyan-Semerci, and Tugce Ercetin, *Reconstructing the Social Contract: A Multi-Domain Framework for Contemporary Democratic Societies*. [Zenodo DOI](https://doi.org/10.5281/zenodo.20443724)
- [Social Contract Indicators Dashboard](https://socialcontractindicators.org/)
- Standard Eurobarometer indicators, primarily 2019-2024.

The index uses a Domain -> Subdomain -> Indicator hierarchy with min-max normalization and hierarchical aggregation. The current data package is a research prototype and retains a methodology notice for indicators whose scoring direction may require expert review.
