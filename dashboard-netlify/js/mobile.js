/* Graphiques sur petit écran : légende sous le graphique et texte plus petit. Chargé avant js/app.js. */
(function(){
  if(!window.Chart) return;
  const small = () => window.innerWidth < 700;
  Chart.register({id:'ejMobile', beforeInit(c){
    if(!small()) return;
    const o = c.config.options || (c.config.options = {});
    o.plugins = o.plugins || {};
    const lg = o.plugins.legend = o.plugins.legend || {};
    if(lg.position === 'right' || lg.position === 'left') lg.position = 'bottom';
    lg.labels = Object.assign({}, lg.labels, {boxWidth:12, font:Object.assign({}, (lg.labels || {}).font, {size:10})});
  }});
  if(small()) Chart.defaults.font.size = 10;
})();
