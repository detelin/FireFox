// ==UserScript==
// @namespace   VA_i
// @version     4.3.0.20170213
// @grant       GM_addStyle
// @grant       unsafeWindow
// @include     /^https?://(?:www|encrypted|ipv[46])\.google\.[^/]+/(?:$|[#?]|search|webhp|imgres)/
// @match       https://news.google.com/*
// @match       https://cse.google.com/cse/*
// @run-at      document-start
// @name        Google: Direct Links for Pages and Images
// @name:zh-CN  Google：直链搜索结果网页及图片
// @name:zh-TW  Google：直鏈搜尋結果網頁及圖片
// @description Show direct links to web pages and images for google result.
// @description:zh-CN 令 Google 直接链接至搜索结果网页以及图片，跳过重定向及图片预览。
// @description:zh-TW 令 Google 直接鏈接至搜尋結果網頁以及圖片，跳過重定向及圖片預覽。
// ==/UserScript==

GM_addStyle('a.x_source_link {' + [
  'line-height: 1.0',  // increment the number for a taller thumbnail info-bar
  'text-decoration: none !important',
  'color: inherit !important',
  'display: block !important'
].join(';') + '}');

unsafeWindow.Function((function () {

var debug = false;
var count = 0;

// web pages: url?url=
// images: imgres?imgurl=
// custom search engine: url?q=
// malware: interstitial?url=
var re = /\b(url|imgres)\?.*?\b(?:url|imgurl|q)=(https?\b[^&#]+)/i;
var restore = function (link, url) {
  var oldUrl = link.getAttribute('href') || '';
  var newUrl = url || oldUrl;
  var matches = newUrl.match(re);
  if (matches) {
    debug && console.log('restoring', link._x_id, newUrl);
    link.setAttribute('href', decodeURIComponent(matches[2]));
    removeReferrer(link);
    if (matches[1] === 'imgres') {
      if (link.querySelector('img[src^="data:"]')) {
        link._x_href = newUrl;
      }
      // make thumbnail info-bar clickable
      var infos = [].slice.call(link.querySelectorAll('img~div span'));
      if (infos.length > 0) {
        var pageUrl = decodeURIComponent(newUrl.match(/[?&]imgrefurl=([^&#]+)/)[1]);
        infos.forEach(function (info, i) {
          setTimeout(function () {
            var pagelink = document.createElement('a');
            removeReferrer(pagelink);
            pagelink.href = pageUrl;
            pagelink.className = 'x_source_link';
            pagelink.textContent = info.textContent;
            info.textContent = '';
            info.appendChild(pagelink);
          }, 10 * i);
        });
      }
    }
  } else if (url) {
    link.setAttribute('href', newUrl);
  }
};

var removeReferrer = function (a) {
  a.setAttribute('rel', 'noreferrer');
  a.setAttribute('referrerpolicy', 'no-referrer');
};

var fakeLink = document.createElement('a');
var normalizeUrl = function (url) {
  fakeLink.href = url;
  return fakeLink.href;
};

var setter = function (v) {
  v = String(v);  // in case an object is passed by clever Google
  debug && console.log('State:', document.readyState);
  debug && console.log('set', this._x_id, this.getAttribute('href'), v);
  restore(this, v);
};
var getter = function () {
  debug && console.log('get', this._x_id, this.getAttribute('href'));
  return normalizeUrl(this._x_href || this.getAttribute('href'));
};
var blocker = function (event) {
  event.stopPropagation();
  restore(this);
  debug && console.log('block', this._x_id, this.getAttribute('href'));
};

var handler = function (a) {
  if (a._x_id) {
    return;
  }
  a._x_id = ++count;
  if (Object.defineProperty) {
    debug && console.log('define property', a._x_id);
    Object.defineProperty(a, 'href', {get: getter, set: setter});
  } else if (a.__defineSetter__) {
    debug && console.log('define getter', a._x_id);
    a.__defineSetter__('href', setter);
    a.__defineGetter__('href', getter);
  } else {
    debug && console.log('define listener', a._x_id);
    a.onmouseenter = a.onmousemove = a.onmouseup = a.onmousedown =
      a.ondbclick = a.onclick = a.oncontextmenu = blocker;
  }
  debug && a.setAttribute('x-id', a._x_id);
  restore(a);
};

var update = function () {
  [].slice.call(document.querySelectorAll('a[href]')).forEach(function (a, i) {
    setTimeout(handler.bind(null, a), 2 * i);
  });
};

var tid = null;
var prev = (new Date()).getTime();
var check = function (mutation) {
  return mutation.addedNodes.length > 0;
};
var checkNewNodes = function (mutations) {
  debug && console.log('State:', document.readyState);
  mutations.forEach && mutations.forEach(checkAttribute);
  var next = (new Date()).getTime();
  if (next - prev > 600) {  // Don't let me wait too long.
    prev = next;
    clearTimeout(tid);
    debug && console.log('forced update');
    update();  // Throttle is what?
  } else if (!mutations.some || mutations.some(check)) {
    clearTimeout(tid);
    tid = setTimeout(update, 200);
  }
};
var checkAttribute = function (mutation) {
  var target = mutation.target;
  if (target && target.nodeName.toUpperCase() === 'A' &&
      (mutation.attributeName || mutation.attrName) === 'href' &&
      re.test(target.getAttribute('href'))) {
    debug && console.log('restore attribute', target._x_id, target.getAttribute('href'));
    restore(target);
  }
};

var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

if (MutationObserver) {
  debug && console.log('MutationObserver: true');
  new MutationObserver(checkNewNodes).observe(document.documentElement, {
    childList: true,
    attributes: true,
    attributeFilter: ['href'],
    subtree: true
  });
} else {
  debug && console.log('MutationEvent: true');
  document.addEventListener('DOMAttrModified', checkAttribute, false);
  document.addEventListener('DOMNodeInserted', checkNewNodes, false);
}

}).toString().match(/{([\s\S]*)}/)[1]).call(unsafeWindow);
