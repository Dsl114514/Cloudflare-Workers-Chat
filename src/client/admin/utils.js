// 管理后台工具函数
import { state } from './state.js';

export const TAG_COLORS = {
  red: "#e74c3c", blue: "#3498db", green: "#2ecc71",
  purple: "#9b59b6", pink: "#e91e63", cyan: "#00bcd4",
  gray: "#95a5a6", orange: "#e67e22",
  yellow: "#ffc107", teal: "#009688", indigo: "#3f51b5",
  brown: "#795548", lime: "#cddc39", deeporange: "#ff5722",
  rose: "#ff80ab", crimson: "#dc143c", coral: "#ff7043",
  gold: "#ffd700", amber: "#ffbf00", forest: "#228b22",
  seagreen: "#2e8b57", turquoise: "#40e0d0", steel: "#4682b4",
  royalblue: "#4169e1", mediumpurple: "#9370db", darkviolet: "#9400d3",
  chocolate: "#d2691e", olive: "#808000", firebrick: "#b22222",
  slateblue: "#6a5acd", darkcyan: "#008b8b", mediumseagreen: "#3cb371",
  indianred: "#cd5c5c", cadetblue: "#5f9ea0"
};

export function escapeHtml(s) {
  let div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function addBorderSelects() {
  document.querySelectorAll('.tag-color-select').forEach(function(sel) {
    if (sel.nextElementSibling && sel.nextElementSibling.classList.contains('tag-border-select')) return;
    var bs = document.createElement('select');
    bs.className = 'tag-border-select';
    bs.style.cssText = 'width:60px;padding:2px 4px;font-size:80%;border:1px solid #ccc;border-radius:3px;margin-left:2px;vertical-align:middle;';
    var o = document.createElement('option'); o.value = ''; o.textContent = '无'; bs.appendChild(o);
    for (var k in TAG_COLORS) {
      var o2 = document.createElement('option');
      o2.value = k; o2.textContent = k;
      o2.style.background = TAG_COLORS[k];
      o2.style.color = ['yellow','lime','gold','amber','rose','gray','coral','turquoise'].indexOf(k) >= 0 ? '#333' : '#fff';
      bs.appendChild(o2);
    }
    sel.parentNode.insertBefore(bs, sel.nextSibling);
  });
}

export const LIGHT_COLORS = new Set(['yellow','lime','gold','amber','rose','gray','coral','turquoise']);
