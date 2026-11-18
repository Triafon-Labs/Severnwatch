# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.0.0](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.23...severnwatch-v1.0.0) (2026-11-18)

* let a Release-As footer set the next release version ([bbefe91](https://github.com/Triafon-Labs/Severnwatch/commit/bbefe9115d8361b8327c612540dde9f7dc1eb8f4))

### Features

* add a conditions key to the Info tab ([ed0b8fa](https://github.com/Triafon-Labs/Severnwatch/commit/ed0b8fa0a0c81fda4838cfd69e2e9ea0a12af632))
* add an upload page for the weekly SAS export ([e6da4f9](https://github.com/Triafon-Labs/Severnwatch/commit/e6da4f91331f6dd5916acd41459d0253d52add25))
* add citizen science sample cards from the SAS CSV export ([96090cf](https://github.com/Triafon-Labs/Severnwatch/commit/96090cfc9bf548674a328302d37cded53db5ed2a))
* add river flow as a third view on the samples chart ([d11fa0a](https://github.com/Triafon-Labs/Severnwatch/commit/d11fa0a01215cf815908a72f122627c5cec3a652))
* always say what the risk is waiting on, and soften the disclaimer ([7b8e12b](https://github.com/Triafon-Labs/Severnwatch/commit/7b8e12bbca66fe9feb077b93098e105b72f6de82))
* chart rain, spills and samples instead of the app's own status ([ae9e833](https://github.com/Triafon-Labs/Severnwatch/commit/ae9e8331ce9876c17d2e5d63fe27720c2ca0055b))
* credit the data sources in the settings sheet ([9ff1a37](https://github.com/Triafon-Labs/Severnwatch/commit/9ff1a371700282dd1abb0f3f41d72be0b1a3252e))
* derive a pollution risk for the reach from spills and rainfall ([a9df069](https://github.com/Triafon-Labs/Severnwatch/commit/a9df06974f607cb3d7742cb615c774403f525b53))
* first-run disclaimer and softer pollution risk wording ([4198e42](https://github.com/Triafon-Labs/Severnwatch/commit/4198e42517dcf7ca627617f5d9aa9ea5e9c7aa24))
* link the upload page from the settings sheet ([8023f06](https://github.com/Triafon-Labs/Severnwatch/commit/8023f06794da2dbd34d18123fcc53d00e733cf78))
* make the scatter's dots tappable and stop it over-claiming ([db914fb](https://github.com/Triafon-Labs/Severnwatch/commit/db914fbfa0ac3cfd24b324ca820cabb90396c9a2))
* make the share text read as a message and drop its disclaimer ([#5](https://github.com/Triafon-Labs/Severnwatch/issues/5)) ([2d432ef](https://github.com/Triafon-Labs/Severnwatch/commit/2d432efe3d0c5eb2c1a8bde77707a9edc2841dea))
* move the "Updated" line into the status card ([c2b8a93](https://github.com/Triafon-Labs/Severnwatch/commit/c2b8a93bdef381d2fa53dfde2f06221a4b6d16c1))
* move the latest sample up to second on the page ([fd79326](https://github.com/Triafon-Labs/Severnwatch/commit/fd793260a5a2f813e5025abf457ee1478d5fbc10))
* overflow map tidy-up, offline monitors, spill durations, and catchment fixes ([#6](https://github.com/Triafon-Labs/Severnwatch/issues/6)) ([ab53c10](https://github.com/Triafon-Labs/Severnwatch/commit/ab53c109ec211059995d45467aff7421f2336d9e))
* pick a sample on the history chart, Paddlecheck-style ([cefe964](https://github.com/Triafon-Labs/Severnwatch/commit/cefe964fcdd66427aeaab47af66e1d1df52a1345))
* plot each sample against the rain and spills before it ([c0d1b62](https://github.com/Triafon-Labs/Severnwatch/commit/c0d1b627b59ece6ece0f804f7d4078b5cf34202c))
* port Paddlecheck's recent UI work for consistency ([201e839](https://github.com/Triafon-Labs/Severnwatch/commit/201e83939c851265d88b90de8e94fc749179e912)), references [392-#410](https://github.com/Triafon-Labs/Severnwatch/issues/410)
* raise the pollution risk for moderate or heavy rain ([eea7c0b](https://github.com/Triafon-Labs/Severnwatch/commit/eea7c0b44e5cb573fc28eedb4d7097f491ba7fb8))
* record the risk hourly and chart it against the samples ([e8db309](https://github.com/Triafon-Labs/Severnwatch/commit/e8db3096c4e8463097e604e3f155ac865fde6bf4))
* replace the logo with a real vector and regenerate every icon ([97d0468](https://github.com/Triafon-Labs/Severnwatch/commit/97d0468bdaef6626242cf7650ec51251e23bf28c))
* reserve High Risk for observed evidence and calm the headline ([0d5ab2c](https://github.com/Triafon-Labs/Severnwatch/commit/0d5ab2c40ea0693de41549e4ee065458b7b13874))
* show the age of rainfall readings, not just of the fetch ([0b42ef2](https://github.com/Triafon-Labs/Severnwatch/commit/0b42ef2644e026e1a8473b5b01cf86285dba49be))
* take the chart's rain from Open-Meteo so it works from day one ([85b546c](https://github.com/Triafon-Labs/Severnwatch/commit/85b546cf7272757aa8264b4be8e3ff6498f95dde))
* use the EA gauges' real rain in the chart, not a model ([c16c81c](https://github.com/Triafon-Labs/Severnwatch/commit/c16c81cfac8f30758ab9999f362d03408f759080))

### Bug Fixes

* address review findings in the pollution risk ([13e1d4c](https://github.com/Triafon-Labs/Severnwatch/commit/13e1d4c439e51086be150484a1c25d5c82f6754a))
* align the CSO map's confluence curves with the river lines ([7f9e80f](https://github.com/Triafon-Labs/Severnwatch/commit/7f9e80fe5052c9d06e8868b4acff0c0bd756c40b))
* correct claims in the conditions key and code comments ([c0f9867](https://github.com/Triafon-Labs/Severnwatch/commit/c0f986754a5e0629472f7a903cbabc50b06482d8))
* correct rainfall and bathing water thresholds against their sources ([7bdb1e8](https://github.com/Triafon-Labs/Severnwatch/commit/7bdb1e8412174fdc32103d45b304d23b58716cb1))
* count only spills above the sample site as high, and raise the rain trigger ([0e2ed90](https://github.com/Triafon-Labs/Severnwatch/commit/0e2ed90f052f3a6f4d2cb61cac31913d56eab984))
* **deps:** bump handlebars to 4.7.10 and source-map-js to 1.2.2 ([c7675c1](https://github.com/Triafon-Labs/Severnwatch/commit/c7675c13336ec5510bf97b4e02e1e0109924566e))
* draw the CSO map's river lines as one smooth line ([559ed92](https://github.com/Triafon-Labs/Severnwatch/commit/559ed92c52944145fbb591cde15e605080b9c888))
* draw the sample history chart on a linear axis ([9026cfc](https://github.com/Triafon-Labs/Severnwatch/commit/9026cfca028f6bf4eff1d5805121fba3a7498c7b))
* draw unmonitored river stops as hollow rings ([ea2675f](https://github.com/Triafon-Labs/Severnwatch/commit/ea2675f2060d46df8959508cdb562184e2ebb9c4)), references [#8A9DA4](https://github.com/Triafon-Labs/Severnwatch/issues/8A9DA4) [#9E9E9E](https://github.com/Triafon-Labs/Severnwatch/issues/9E9E9E)
* drop the 5-minute background poll ([d53c8b4](https://github.com/Triafon-Labs/Severnwatch/commit/d53c8b4a0b381cc5bb89dae9e56e4ab74191fd0a))
* drop the rainfall spill likelihood from the share text ([3fd114d](https://github.com/Triafon-Labs/Severnwatch/commit/3fd114dd815a59f5c4d96c5095235e389c5323eb))
* give the rainfall chart Paddlecheck's tooltip ([7f90ce5](https://github.com/Triafon-Labs/Severnwatch/commit/7f90ce5a553fb158b2ea5f60b925df728bea3c54))
* give the river map's expandable rows Paddlecheck's state layer ([0fbab7d](https://github.com/Triafon-Labs/Severnwatch/commit/0fbab7d4885fb7d5f0806e130a3ea6a3a776b0ad))
* judge measured rain by its peak 15-minute rate, not the hourly sum ([0eec40e](https://github.com/Triafon-Labs/Severnwatch/commit/0eec40eff9c3ca1813b6f3a2891e854786c343ae))
* keep the bottom card from jumping the page, and fill in missing motion ([7e2e63a](https://github.com/Triafon-Labs/Severnwatch/commit/7e2e63a45d896a3cc86f952fafc795a8b12478b9))
* label the sample chart's bands, not its limit lines ([6a27239](https://github.com/Triafon-Labs/Severnwatch/commit/6a2723971a6cb0cd101cdfb4f42c59b0ab62bd12))
* leave out the Navigation Road overflow below Diglis weir ([a862a18](https://github.com/Triafon-Labs/Severnwatch/commit/a862a18b7119b1036d9b711dd832be1b16dd086f))
* link to a short explainer for the official classifications ([6f2b10b](https://github.com/Triafon-Labs/Severnwatch/commit/6f2b10ba7aed781fd4baa7868aa01abddd80403e))
* make loading skeletons match the cards they stand in for ([06ce534](https://github.com/Triafon-Labs/Severnwatch/commit/06ce5342c3bc70fe6bba561a3adb64f89b103ecd))
* make Severnwatch installable from Chrome ([9cdc31c](https://github.com/Triafon-Labs/Severnwatch/commit/9cdc31c4e4a86f25fb497cdcd69c155f7663e74f))
* match the classifications heading to Paddlecheck's in-card headings ([4b10d95](https://github.com/Triafon-Labs/Severnwatch/commit/4b10d9513081a2e62889be456d2996acdbc4eb65))
* match the rainfall period tiles to Paddlecheck's change tiles ([5929b0c](https://github.com/Triafon-Labs/Severnwatch/commit/5929b0c0841b9bb29ef781ce238e5b6f0e767d9a))
* name and colour samples after the classification tiers ([d8377b6](https://github.com/Triafon-Labs/Severnwatch/commit/d8377b62b292f679d1a93bcbec5b71ecc1c06f50))
* read the SAS Water Quality Surveys export instead of the map download ([7f2dfcd](https://github.com/Triafon-Labs/Severnwatch/commit/7f2dfcdef24cef42dffd7ed842983c2da6a9493a))
* restore the offline service worker ([2a372b2](https://github.com/Triafon-Labs/Severnwatch/commit/2a372b2e34bcb431be7820cf4644023abc6346a0))
* show testers' notes in the sample history without hover ([53b4723](https://github.com/Triafon-Labs/Severnwatch/commit/53b472300a25034472ee9a9088d9c6402bac16f8))
* stop clipping the rainfall chart's y-axis labels ([e8a6187](https://github.com/Triafon-Labs/Severnwatch/commit/e8a61873fc9fd9797285c947fdb6a7773ac29477))
* stop stale data and the stale banner surviving a refresh ([9ce2494](https://github.com/Triafon-Labs/Severnwatch/commit/9ce24943fcf9d941d866d3995facc73334bb2a93))

### Performance Improvements

* cache outfall place names instead of geocoding every rebuild ([c4aff9b](https://github.com/Triafon-Labs/Severnwatch/commit/c4aff9b4ff2b8f17b5bcbf0fa1380fc600dc96cc))
* lazy-load the rainfall chart ([231cc19](https://github.com/Triafon-Labs/Severnwatch/commit/231cc19e44a13d0a0da565b2e900f4b3f92e50b9))
* load the two-axis Roboto Flex file instead of the full one ([f511498](https://github.com/Triafon-Labs/Severnwatch/commit/f51149821c3ebb989494a441da8f2bb0a9eadfaa))
* start the data requests from the page head ([9c8cb37](https://github.com/Triafon-Labs/Severnwatch/commit/9c8cb372726494f3488e179d3b7a29c76b36831c))
* stop loading a 914KB file for the 40px app bar logo ([4fbdcfb](https://github.com/Triafon-Labs/Severnwatch/commit/4fbdcfb1f51758f59e6406ed10589009524884e1))

### Code Refactoring

* base the risk on spills alone and match Paddlecheck's layout ([8ed9f83](https://github.com/Triafon-Labs/Severnwatch/commit/8ed9f83a3b25936e72bce23499b5253486183281))
* drop the "Notable" findings from the latest sample card ([06b1280](https://github.com/Triafon-Labs/Severnwatch/commit/06b12802dc7165041370fe59458c69eacb87ecae))
* drop the latest sample line from the pollution risk card ([39092ad](https://github.com/Triafon-Labs/Severnwatch/commit/39092ad9ff8a8704da63597c3a4ab8aa7e53665e))
* drop the outlook line under the pollution risk headline ([9bdf7a2](https://github.com/Triafon-Labs/Severnwatch/commit/9bdf7a28bc92a1067ff0a70b5da487c740e2c66f))
* drop thermotolerant coliforms from the sample cards ([55aba08](https://github.com/Triafon-Labs/Severnwatch/commit/55aba085e09a1793cc9c94adac5d93312a305fca))
* move useNowTicking out of lib/time.ts ([7ceeff9](https://github.com/Triafon-Labs/Severnwatch/commit/7ceeff95c75a0501e38cb0cdf5792dedd5e5fdfe))
* read the app name and description from config ([442c566](https://github.com/Triafon-Labs/Severnwatch/commit/442c56657d2541f8f685041d91b0ba5db7907c84))
* remove the SAS map embed card ([64b9860](https://github.com/Triafon-Labs/Severnwatch/commit/64b98604cbd9d7dff87d3141a1bd94f06ccf41ee))
* shorten "How Limits Work" and link out for the official method ([a954855](https://github.com/Triafon-Labs/Severnwatch/commit/a9548555cfd2d5049bc90d1c37de7003e49a68fb))
* treat every spill in the Worcester reach the same ([028d237](https://github.com/Triafon-Labs/Severnwatch/commit/028d237c4db78756f94e1af6e8c68cff6f1a73d4))
* trim the sample cards ([9aa846f](https://github.com/Triafon-Labs/Severnwatch/commit/9aa846f270877f88a132b0b6754edac418ed13ba))
* trim the sample chart tooltip to the headline figure ([664e578](https://github.com/Triafon-Labs/Severnwatch/commit/664e5785a1300343ce9dd8eef08fb276b48e067e))

### Documentation

* correct the conditions key's caption-spacing comment ([cfb59f0](https://github.com/Triafon-Labs/Severnwatch/commit/cfb59f07c480c902aa060bab96a8d8eda5705a4d))
* describe the keep-alive's hard-coded site URL ([a5d9d0e](https://github.com/Triafon-Labs/Severnwatch/commit/a5d9d0edcea0c2ba38583735a9cb7d87b9ee9cde))
* describe where the chart's rain now comes from ([b3f31dc](https://github.com/Triafon-Labs/Severnwatch/commit/b3f31dc8565e26b23fa067db48c0171ad22027b7))
* explain how the app grades a sample against the official classification ([3aa6248](https://github.com/Triafon-Labs/Severnwatch/commit/3aa6248c93456f9e49a0e1cf074249bc9bcfa16d))

## [0.1.23](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.22...severnwatch-v0.1.23) (2026-10-15)

## [0.1.22](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.21...severnwatch-v0.1.22) (2026-09-26)


### Features

* keep map legend side-by-side in fullscreen landscape mode ([d2ff9c6](https://github.com/Triafon-Labs/Severnwatch/commit/d2ff9c683a58cb689a15973083449bb75ee30d0d))
* keep map legend visible and minimisable in fullscreen ([a0b79f6](https://github.com/Triafon-Labs/Severnwatch/commit/a0b79f67b9f7dfde0ac1a9f1b16866c325fb21ad))

## [0.1.21](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.20...severnwatch-v0.1.21) (2026-09-26)

## [0.1.20](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.19...severnwatch-v0.1.20) (2026-09-26)


### Features

* update top headline to water quality status ([0308129](https://github.com/Triafon-Labs/Severnwatch/commit/0308129e5edfeceaaec65bf1a32244a748d1090b))

## [0.1.19](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.18...severnwatch-v0.1.19) (2026-09-05)

## [0.1.18](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.17...severnwatch-v0.1.18) (2026-09-02)


### Bug Fixes

* auto refresh stale cached data on app open and focus ([8e26049](https://github.com/Triafon-Labs/Severnwatch/commit/8e2604987badcce446d3b06053ddf2695a724dd2))

## [0.1.17](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.16...severnwatch-v0.1.17) (2026-09-01)

## [0.1.16](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.15...severnwatch-v0.1.16) (2026-08-31)

## [0.1.15](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.14...severnwatch-v0.1.15) (2026-08-30)


### Features

* collapse clear monitors into sub-group within stations ([06abaa3](https://github.com/Triafon-Labs/Severnwatch/commit/06abaa3896a8f72cff077cdefbf622d213a93cdb))
* group clear monitors into collapsible sub-row within station drops ([ba6aa40](https://github.com/Triafon-Labs/Severnwatch/commit/ba6aa404241ac8066895e87733ba52b1e1e5fe33))


### Performance Improvements

* optimize rainfall time range switching and CSO dropdown toggle ([0203520](https://github.com/Triafon-Labs/Severnwatch/commit/0203520fb34899c0ef52198e3ac6e55467e4beb1))
* use auto timeout for Collapse on river schematic dropdowns ([6d7fed3](https://github.com/Triafon-Labs/Severnwatch/commit/6d7fed3f42d2526b1151cf689456741488648197))

## [0.1.14](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.13...severnwatch-v0.1.14) (2026-08-30)


### Bug Fixes

* update recent spill ended timing format and align row icons ([0c92bd0](https://github.com/Triafon-Labs/Severnwatch/commit/0c92bd016422761ce3c40d63b06cdaccb0d4358a))

## [0.1.13](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.12...severnwatch-v0.1.13) (2026-08-28)


### Bug Fixes

* **cso:** surface recent spills and counts in overall status hero ([0733b76](https://github.com/Triafon-Labs/Severnwatch/commit/0733b763a8995ded49000571041dcab9b631cd2f))
* **cso:** surface recent spills and spill counts in overall status hero ([e79ec04](https://github.com/Triafon-Labs/Severnwatch/commit/e79ec049e07aa49ed60dfd3def0afa55b17e83ab))

## [0.1.12](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.11...severnwatch-v0.1.12) (2026-08-28)


### Features

* align Severnwatch with Paddlecheck UI ([6632d57](https://github.com/Triafon-Labs/Severnwatch/commit/6632d57c1426aae6337f7bb468edea988387f4d5))
* enhance RainfallCard UI components for better alignment with Paddlecheck design ([dabb571](https://github.com/Triafon-Labs/Severnwatch/commit/dabb571df629a3e0a507a64d4fd8c5e48253ffe5))

## [0.1.11](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.10...severnwatch-v0.1.11) (2026-08-21)

## [0.1.10](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.9...severnwatch-v0.1.10) (2026-08-20)

## [0.1.9](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.8...severnwatch-v0.1.9) (2026-08-20)


### Code Refactoring

* remove redundant data timestamps and clarify copy ([d3fd235](https://github.com/Triafon-Labs/Severnwatch/commit/d3fd235ab989bda0c6f71f0719c6a09487a39be0))

## [0.1.8](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.7...severnwatch-v0.1.8) (2026-08-20)


### Features

* **rainfall:** align thresholds to standards and streamline forecast UX ([5a0ac16](https://github.com/Triafon-Labs/Severnwatch/commit/5a0ac162b88465a59dbdb0aedd84e2a8dda4d9b2))
* **rainfall:** align thresholds with UK Met Office standards ([31d38d2](https://github.com/Triafon-Labs/Severnwatch/commit/31d38d2f90b8a24c11a6f1f9c4b6875e0489e809))

## [0.1.7](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.6...severnwatch-v0.1.7) (2026-08-20)


### Bug Fixes

* include Holt River Severn CSO in catchment corridor ([51f2061](https://github.com/Triafon-Labs/Severnwatch/commit/51f206115c8ae87fc554e7b6a1dc0f28777584a0))
* refine River Severn waypoint coordinates and include Holt CSO ([0cd95d1](https://github.com/Triafon-Labs/Severnwatch/commit/0cd95d1def5d8e1ac9f4dcf45a1cafe57e4eed5f))

## [0.1.6](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.5...severnwatch-v0.1.6) (2026-08-20)


### Features

* improve CSO location descriptions and catchment waypoint assignment ([303706b](https://github.com/Triafon-Labs/Severnwatch/commit/303706b09f32105e879b6f1e1684365ad08aa7bd))

## [0.1.5](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.4...severnwatch-v0.1.5) (2026-08-20)


### Bug Fixes

* correct sewage spill duration calculation for recent spills ([b74bf51](https://github.com/Triafon-Labs/Severnwatch/commit/b74bf515beaaaaa787c035107142c4d60b81466c))

## [0.1.4](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.3...severnwatch-v0.1.4) (2026-08-16)

## [0.1.3](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.2...severnwatch-v0.1.3) (2026-08-16)

## [0.1.2](https://github.com/Triafon-Labs/Severnwatch/compare/severnwatch-v0.1.1...severnwatch-v0.1.2) (2026-08-16)


### Features

* replace the CSO list with a river schematic ([a1b7046](https://github.com/Triafon-Labs/Severnwatch/commit/a1b70461c606e7ba6897276ebedad8b9b03a4679))
* scale the spill window by travel time, and mark the real reach ([e263c32](https://github.com/Triafon-Labs/Severnwatch/commit/e263c32d3a75802f0394f669b123f77761489d67))


### Bug Fixes

* close the Shrawley coverage gap and extend the reach to Diglis ([7e631d5](https://github.com/Triafon-Labs/Severnwatch/commit/7e631d515436ab1ce9e6e6741ea7b2a5d5021568))

## 0.1.1 (2026-08-16)


### Features

* add bathing water classification explainer under the water quality map ([cf05e6e](https://github.com/Triafon-Labs/Severnwatch/commit/cf05e6ebc9ab3c3ec0fa639ee77df733346ed07b))
* add full CSO monitoring list card below the spill status summary ([8be05d8](https://github.com/Triafon-Labs/Severnwatch/commit/8be05d81598b688ec60bc647700514bae9b35302))
* add rainfall data for the Worcester-to-Bewdley catchment ([db9b59f](https://github.com/Triafon-Labs/Severnwatch/commit/db9b59fe53b2feec98517a2f7fd7e3c861c8f0b9))
* add rainfall forecast via Open-Meteo ([fc560b9](https://github.com/Triafon-Labs/Severnwatch/commit/fc560b934e8562204a6d8a1cf654b8559d8d93dc))
* adopt Paddlecheck's Material Design 3 system and repo tooling ([7f97d0a](https://github.com/Triafon-Labs/Severnwatch/commit/7f97d0ac4dd40ae38bca9a150759db464eb5f5d7)), closes [#006C7](https://github.com/Triafon-Labs/Severnwatch/issues/006C7)
* embed the SAS citizen science water quality map ([7c4db5b](https://github.com/Triafon-Labs/Severnwatch/commit/7c4db5b2d54f9ce52147401bafc80f9229abd873))
* make Severnwatch installable as a PWA ([2897640](https://github.com/Triafon-Labs/Severnwatch/commit/289764029d1b026f6cb0b12f0570ed38b99838bc))
* redesign Rainfall card as range selector + change tiles + likelihood ([d6a9d75](https://github.com/Triafon-Labs/Severnwatch/commit/d6a9d755e55e84503d3e2b8e5d1f65097254157f))
* settings/info dialog with theme switch, collapsible CSOs, and a clearer rainfall chart ([24db018](https://github.com/Triafon-Labs/Severnwatch/commit/24db01860b010fc3a1e41966191758bac32616a2))
* show CSO sewage spill status for the Worcester-to-Bewdley catchment ([34632d8](https://github.com/Triafon-Labs/Severnwatch/commit/34632d8213cfc66440eec6cf0b27d3d1931c65fe))
* use the app's wave logo in the nav bar ([92a4e4f](https://github.com/Triafon-Labs/Severnwatch/commit/92a4e4f6baadc27910d0c4f290f123e72af63b51))


### Bug Fixes

* clean up rainfall chart axis readability ([2bbe556](https://github.com/Triafon-Labs/Severnwatch/commit/2bbe556b5d57ee777d442016fee532121e07e052))
* correct agent docs, port the keep-alive workflow, bump the SW cache ([1dc9db6](https://github.com/Triafon-Labs/Severnwatch/commit/1dc9db6ba875738350fa52c59b78c2ac7777fb35))
