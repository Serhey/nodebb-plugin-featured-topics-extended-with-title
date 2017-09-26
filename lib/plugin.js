'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; // Featured Topics Extended

exports.init = init;
exports.homepageGet = homepageGet;
exports.getFeaturedTopicsLists = getFeaturedTopicsLists;
exports.getFeaturedTopicsList = getFeaturedTopicsList;
exports.getFeaturedTopicsListBySlug = getFeaturedTopicsListBySlug;
exports.getFeaturedTopics = getFeaturedTopics;
exports.getFeaturedTopicsBySlug = getFeaturedTopicsBySlug;
exports.getAreas = getAreas;
exports.getWidgets = getWidgets;
exports.renderFeaturedTopicsSidebar = renderFeaturedTopicsSidebar;
exports.renderFeaturedTopicsBlocks = renderFeaturedTopicsBlocks;
exports.renderFeaturedTopicsCards = renderFeaturedTopicsCards;
exports.renderFeaturedTopicsList = renderFeaturedTopicsList;
exports.renderFeaturedTopicsNews = renderFeaturedTopicsNews;
exports.newsRender = newsRender;
exports.addNavs = addNavs;
exports.adminBuild = adminBuild;
exports.addThreadTools = addThreadTools;
exports.addPostTools = addPostTools;
exports.topicPost = topicPost;
exports.topicDelete = topicDelete;
exports.userProfileMenu = userProfileMenu;
exports.buildWidgets = buildWidgets;

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _winston = require('winston');

var _winston2 = _interopRequireDefault(_winston);

var _templates = require('templates.js');

var _templates2 = _interopRequireDefault(_templates);

var _validator = require('validator');

var _validator2 = _interopRequireDefault(_validator);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var accountHelpers = require.main.require('./src/controllers/accounts/helpers');
var helpers = require.main.require('./src/controllers/helpers');
var Topics = require.main.require('./src/topics');
var Posts = require.main.require('./src/posts');
var db = require.main.require('./src/database');
var translator = require.main.require('./public/src/modules/translator');
var nconf = require.main.require('nconf');
var Settings = require.main.require('./src/settings');
var User = require.main.require('./src/user');
var SocketAdmin = require.main.require('./src/socket.io/admin');
var SocketPlugins = require.main.require('./src/socket.io/plugins');
var Utils = require.main.require('./public/src/utils');

var defaultSettings = {
  newsTemplate: 'porta',
  newsHideAnon: 0,
  customTemplate: ''
};

var app = void 0,
    settings = void 0;
var GLOBALUID = 0;

// Hook static:app.load
// Setup routes and settings.
function init(params, next) {
  app = params.app;
  settings = new Settings('featured-topics-extended', '1.0.0', defaultSettings);

  var router = params.router;
  var middleware = params.middleware;

  router.get('/news', middleware.buildHeader, renderNewsPage);
  router.get('/news/:page', middleware.buildHeader, renderNewsPage);
  router.get('/api/news', renderNewsPage);
  router.get('/api/news/:page', renderNewsPage);
  router.get('/api/news', renderNewsPage);
  router.get('/api/news/:page', renderNewsPage);

  router.get('/featured', middleware.buildHeader, renderEditor);
  router.get('/api/featured', renderEditor);

  function renderEditor(req, res) {
    var data = {};

    User.isAdminOrGlobalMod(req.uid, function (err, isAdminOrGlobalMod) {
      data.isSelf = isAdminOrGlobalMod;

      prepareEditor(req, res, 0, data, 0, 0, function (err, data) {
        res.render('fte-featured', data);
      });
    });
  }

  router.get('/user/:userslug/blog', middleware.buildHeader, renderBlogPage);
  router.get('/api/user/:userslug/blog', renderBlogPage);
  router.get('/user/:userslug/blog/:page', middleware.buildHeader, renderBlogPage);
  router.get('/api/user/:userslug/blog/:page', renderBlogPage);
  router.get('/user/:userslug/featured/:listslug', middleware.buildHeader, renderBlogPage);
  router.get('/api/user/:userslug/featured/:listslug', renderBlogPage);
  router.get('/user/:userslug/featured/:listslug/:page', middleware.buildHeader, renderBlogPage);
  router.get('/api/user/:userslug/featured/:listslug/:page', renderBlogPage);

  router.get('/user/:userslug/featured', middleware.buildHeader, renderUserFeatured);
  router.get('/api/user/:userslug/featured', renderUserFeatured);

  function renderUserFeatured(req, res) {
    prepareAccountPage(req, 'account/fte-featured', 'Featured Topic Lists', function (err, userData) {
      if (err) {
        _winston2.default.error(err);
        return res.redirect('/user/' + req.params.userslug + '/');
      }

      var theirid = userData.theirid;


      prepareEditor(req, res, theirid, userData, 0, 0, function (err, data) {
        data.title = userData.username + ' [[fte:featuredtopics]]';
        data.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[fte:featuredtopics]]' }]);

        res.render('account/fte-featured', data);
      });
    });
  }

  function prepareAccountPage(req, tpl, name, next) {
    accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, function (err, userData) {
      if (err) return next(err);

      next(null, userData);
    });
  }

  function prepareEditor(req, res, theirid, data, page, size, next) {
    getFeaturedTopicsLists(req.uid, theirid, function (err, lists) {
      if (err) {
        _winston2.default.error(err);
        return res.redirect(theirid ? '/user/' + req.params.userslug + '/' : '/');
      }

      data.lists = lists;
      data.list = lists[0];

      getFeaturedTopics(req.uid, theirid, lists[0].name, page, size, function (err, topics) {
        data.topics = topics;
        next(null, data);
      });
    });
  }

  router.get('/admin/plugins/featured-topics-extended', middleware.admin.buildHeader, renderAdmin);
  router.get('/api/admin/plugins/featured-topics-extended', renderAdmin);

  function renderAdmin(req, res, next) {
    getFeaturedTopicsLists(req.uid, 0, function (err, lists) {
      res.render('admin/plugins/featured-topics-extended', { lists: lists.map(function (list) {
          return { name: list };
        }) });
    });
  }

  SocketAdmin.settings.syncFeaturedTopicsExtended = function () {
    settings.sync();
  };

  SocketPlugins.FeaturedTopicsExtended = {};

  SocketPlugins.FeaturedTopicsExtended.getFeaturedTopics = function (socket, data, next) {
    var uid = socket.uid;
    var theirid = data.theirid,
        slug = data.slug,
        page = data.page,
        size = data.size;


    theirid = parseInt(theirid, 10) || 0;

    getFeaturedTopicsBySlug(uid, theirid, slug, page, size, function (err, topics) {
      if (err) return next(err);

      getFeaturedTopicsListBySlug(uid, theirid, slug, function (err, list) {
        if (err) return next(err);

        next(null, { list: list, topics: topics });
      });
    });
  };

  SocketPlugins.FeaturedTopicsExtended.getFeaturedTopicsLists = function (socket, data, next) {
    var uid = socket.uid;
    var theirid = data.theirid;


    theirid = parseInt(theirid, 10) || 0;

    getFeaturedTopicsLists(uid, theirid, next);
  };

  SocketPlugins.FeaturedTopicsExtended.featureTopic = function (socket, data, next) {
    var tid = data.tid,
        slug = data.slug;
    var uid = socket.uid;
    var theirid = data.theirid;


    var isSelf = parseInt(uid, 10) === parseInt(theirid, 10);

    theirid = parseInt(theirid, 10) || 0;

    User.isAdminOrGlobalMod(uid, function (err, isAdminOrGlobalMod) {
      if (err) return next(err);

      if (theirid) {
        // User Featured List
        if (!isSelf) return next(new Error('Cannot change another user\'s featured topics.'));
      } else {
        // Global List
        if (!isAdminOrGlobalMod) return next(err || new Error('[[error:no-privileges]]'));
      }

      featureTopic(theirid, tid, slug, next);
    });
  };

  SocketPlugins.FeaturedTopicsExtended.unfeatureTopic = function (socket, data, next) {
    var tid = data.tid,
        slug = data.slug;
    var uid = socket.uid;
    var theirid = data.theirid;


    var isSelf = parseInt(uid, 10) === parseInt(theirid, 10);

    theirid = parseInt(theirid, 10) || 0;

    User.isAdminOrGlobalMod(uid, function (err, isAdminOrGlobalMod) {
      if (err) return next(err);

      if (theirid) {
        // User Featured List
        if (!isSelf) return next(new Error('Cannot change another user\'s featured topics.'));
      } else {
        // Global List
        if (!isAdminOrGlobalMod) return next(err || new Error('[[error:no-privileges]]'));
      }

      unfeatureTopic(theirid, tid, slug, next);
    });
  };

  SocketPlugins.FeaturedTopicsExtended.createList = function (socket, data, next) {
    var uid = socket.uid;
    var theirid = data.theirid,
        list = data.list;

    var isSelf = parseInt(uid, 10) === parseInt(theirid, 10);

    theirid = parseInt(theirid, 10) || 0;

    User.isAdminOrGlobalMod(uid, function (err, isAdminOrGlobalMod) {
      if (err) return next(err);

      if (theirid) {
        // User Featured List
        if (!isSelf) return next(new Error('Cannot change another user\'s featured topics lists.'));
      } else {
        // Global List
        if (!isAdminOrGlobalMod) return next(err || new Error('[[error:no-privileges]]'));
      }

      createList(theirid, list, next);
    });
  };

  SocketPlugins.FeaturedTopicsExtended.deleteList = function (socket, data, next) {
    var uid = socket.uid;
    var theirid = data.theirid,
        slug = data.slug;

    var isSelf = parseInt(uid, 10) === parseInt(theirid, 10);

    theirid = parseInt(theirid, 10) || 0;

    User.isAdminOrGlobalMod(uid, function (err, isAdminOrGlobalMod) {
      if (err) return next(err);

      if (theirid) {
        // User Featured List
        if (slug === 'blog') return next(new Error('Cannot delete the list Blog.'));
        if (!isSelf) return next(new Error('Cannot change another user\'s featured topics lists.'));
      } else {
        // Global List
        if (slug === 'news') return next(new Error('Cannot delete the list News.'));
        if (!isAdminOrGlobalMod) return next(err || new Error('[[error:no-privileges]]'));
      }

      deleteList(theirid, slug, next);
    });
  };

  SocketPlugins.FeaturedTopicsExtended.setAutoFeature = function (socket, data, next) {
    var uid = socket.uid;
    var theirid = data.theirid,
        slug = data.slug,
        autoFeature = data.autoFeature;

    var isSelf = parseInt(uid, 10) === parseInt(theirid, 10);

    theirid = parseInt(theirid, 10) || 0;
    autoFeature = typeof autoFeature === 'string' ? autoFeature : '';
    autoFeature = autoFeature.replace(/ /g, '').split(',').map(function (cid) {
      return parseInt(cid, 10);
    }).filter(function (cid) {
      return cid;
    });

    User.isAdminOrGlobalMod(uid, function (err, isAdminOrGlobalMod) {
      if (err) return next(err);

      if (theirid) {
        // User Featured List
        if (!isSelf) return next(new Error('Cannot change another user\'s featured topics lists.'));
      } else {
        // Global List
        if (!isAdminOrGlobalMod) return next(err || new Error('[[error:no-privileges]]'));
      }

      setAutoFeature(theirid, slug, autoFeature, next);
    });
  };

  // Import News Page list. Depreciated. Remove in v1.0.0
  db.exists('featuredex:tids', function (err, exists) {
    if (err || !exists) return next();

    db.getSortedSetRangeByScore('featuredex:tids', 0, 10000, 0, '+inf', function (err, tids) {
      if (err || !tids || !tids.length) {
        return next();
      }

      createList(0, 'News', function (err) {
        if (err) return next();

        _async2.default.each(tids, function (tid, next) {
          featureTopic(0, tid, 'News', next);
        }, function (err) {
          if (err) return next();

          if (settings.get('autoFeature')) {
            setAutoFeature(0, 'news', settings.get('autoFeature').replace(/ /g, '').split(',').map(function (cid) {
              return parseInt(cid, 10);
            }).filter(function (cid) {
              return cid;
            }), function () {});
          }

          db.delete('featuredex:tids');
          next();
        });
      });
    });
  });
}

// Hook filter:homepage.get
// Add the news page as a selectable Homepage.
//death add
function homepageGet(data, next) {
  data.routes.push({
	  title:'Главные новости',
	  browserTitle: 'Main news',
    route: 'news',
    name: 'Главные новости'
  });

  next(null, data);
}

function featureTopic(theirid, tid, slug, next) {
  slug = Utils.slugify(slug);

  getListNameBySlug(theirid, slug, function (err, list) {
    if (err) return next(err);

    var listkey = 'fte:' + theirid + ':lists';
    var topicskey = 'fte:' + theirid + ':list:' + list + ':tids';

    _winston2.default.info('Featuring ' + tid + ' on ' + topicskey + ' in ' + listkey);

    _async2.default.waterfall([_async2.default.apply(db.isSortedSetMember, listkey, list), function (exists, next) {
      if (!exists) return next(new Error('List ' + list + ' does not exist.'));
      next();
    }, _async2.default.apply(Topics.getTopicField, tid, 'timestamp'), function (timestamp, next) {
      db.sortedSetAdd('tid:' + tid + ':featured', 0, theirid + ':' + list);
      db.sortedSetAdd(topicskey, timestamp, tid, next);
    }], next);
  });
}

function unfeatureTopic(theirid, tid, slug, next) {
  slug = Utils.slugify(slug);

  getListNameBySlug(theirid, slug, function (err, list) {
    if (err) return next(err);

    var topicskey = 'fte:' + theirid + ':list:' + list + ':tids';

    _winston2.default.info('Unfeaturing ' + tid + ' on ' + topicskey);

    db.sortedSetRemove('tid:' + tid + ':featured', theirid + ':' + list);
    db.sortedSetRemove(topicskey, tid, next);
  });
}

function getFeaturedTopicsLists(uid, theirid, next) {
  // TODO: List access perms.
  _async2.default.waterfall([_async2.default.apply(createDefaultFeaturedList, theirid), _async2.default.apply(db.getSortedSetRangeByScore, 'fte:' + theirid + ':lists', 0, 10000, 0, '+inf'), function (lists, next) {
    lists = lists.map(function (list) {
      return 'fte:' + theirid + ':list:' + list;
    });

    next(null, lists);
  }, _async2.default.apply(db.getObjects), function (lists, next) {
    lists = lists.map(function (list) {
      list.userTitle = _validator2.default.escape(list.name);
      return list;
    });

    _async2.default.each(lists, function (list, next) {
      db.getSortedSetRange('fte:' + theirid + ':list:' + list.name + ':autofeature', 0, -1, function (err, autoFeature) {
        list.autoFeature = autoFeature;
        next();
      });
    }, function () {
      next(null, lists);
    });
  }], next);
}

function getFeaturedTopicsList(uid, theirid, list, next) {
  db.getObject('fte:' + theirid + ':list:' + list, function (err, list) {
    if (err) return next(err);

    list.userTitle = _validator2.default.escape(list.name);

    db.getSortedSetRange('fte:' + theirid + ':list:' + list.name + ':autofeature', 0, -1, function (err, autoFeature) {
      if (err) return next(err);

      list.autoFeature = autoFeature;

      next(null, list);
    });
  });
}

function getFeaturedTopicsListBySlug(uid, theirid, slug, next) {
  getListNameBySlug(theirid, slug, function (err, list) {
    if (err) return next(err);

    getFeaturedTopicsList(uid, theirid, list, next);
  });
}

function getFeaturedTopics(uid, theirid, list, page, size, callback) {
  page = parseInt(page);
  page = page > 0 ? page : 1;
  size = parseInt(size);
  size = size > 0 ? size : 10;
  page--;

  _async2.default.waterfall([_async2.default.apply(db.getSortedSetRevRangeByScore, 'fte:' + theirid + ':list:' + list + ':tids', page * size, size, '+inf', 0), function (tids, next) {
    _async2.default.each(tids, function (tid, next) {
      db.isSortedSetMember('topics:tid', tid, function (err, exists) {
        if (!err && !exists) {
          unfeatureTopic(theirid, tid, list, function () {
            getFeaturedTopics(uid, theirid, list, page + 1, size, callback);
          });
        } else {
          next();
        }
      });
    }, function () {
      next(null, tids);
    });
  }, _async2.default.apply(getTopicsWithMainPost, uid)], callback);
}

function getFeaturedTopicsBySlug(uid, theirid, slug, page, size, next) {
  getListNameBySlug(theirid, slug, function (err, list) {
    if (err) return next(err);

    getFeaturedTopics(uid, theirid, list, page, size, next);
  });
}

// Create a blank default list.
function createDefaultFeaturedList(theirid, next) {
  theirid = parseInt(theirid, 10) || 0;

  var key = 'fte:' + theirid + ':lists';
  var list = theirid ? 'Blog' : 'News';

  db.sortedSetScore(key, list, function (err, score) {
    if (err) return next(err);
    if (!score) return createList(theirid, list, next);
    next();
  });
}

function createList(theirid, list, next) {
  theirid = parseInt(theirid, 10) || 0;

  var slug = Utils.slugify(list);
  var created = Date.now();

  _async2.default.waterfall([_async2.default.apply(isListValid, theirid, slug), _async2.default.apply(db.sortedSetAdd, 'fte:' + theirid + ':lists', created, list), _async2.default.apply(db.sortedSetAdd, 'fte:' + theirid + ':lists:bytopics', 0, list), _async2.default.apply(db.sortedSetAdd, 'fte:' + theirid + ':lists:byslug', 0, slug + ':' + list), _async2.default.apply(db.setObjectField, 'fte:' + theirid + ':lists:slugs', slug, list), _async2.default.apply(db.setObject, 'fte:' + theirid + ':list:' + list, {
    name: list,
    topics: 0,
    slug: slug,
    created: created
  })], next);
}

function deleteList(theirid, slug, next) {
  theirid = parseInt(theirid, 10) || 0;

  getListNameBySlug(theirid, slug, function (err, list) {
    if (err) return next(err);

    _async2.default.parallel([_async2.default.apply(db.sortedSetRemove, 'fte:' + theirid + ':lists', list), _async2.default.apply(db.sortedSetRemove, 'fte:' + theirid + ':lists:bytopics', list), _async2.default.apply(db.sortedSetRemove, 'fte:' + theirid + ':lists:byslug', slug + ':' + list), _async2.default.apply(db.deleteObjectField, 'fte:' + theirid + ':lists:slugs', slug), _async2.default.apply(db.delete, 'fte:' + theirid + ':list:' + list), function (next) {
      db.getSortedSetRange('fte:' + theirid + ':list:' + list + ':autofeature', 0, -1, function (err, cids) {
        if (err) return next(err);

        _async2.default.parallel([_async2.default.apply(_async2.default.each, cids, function (cid, next) {
          db.sortedSetRemove('fte:autofeature:' + cid, list, next);
        }), _async2.default.apply(db.delete, 'fte:' + theirid + ':list:' + list + ':autofeature')], next);
      });
    }], next);
  });
}

function isListValid(theirid, slug, next) {
  getListNameBySlug(theirid, slug, function (err, list) {
    next(list ? new Error('List already exists.') : err);
  });
}

function getListNameBySlug(theirid, slug, next) {
  var key = 'fte:' + theirid + ':lists:slugs';

  db.getObjectField(key, slug, next);
}

// Filter an array of topics and add the main post.
function declOfNum(number, titles) {
	var cases = [2, 0, 1, 1, 1, 2];
	return titles[ (number%100>4 && number%100<20)? 2 : cases[(number%10<5)?number%10:5] ];
};

function getTopicsWithMainPost(uid, tids, cb) {
  Topics.getTopics(tids, uid, function (err, topicsData) {
    if (err) return cb(err);

    var recycle = false;
	var cases = [2, 0, 1, 1, 1, 2];
    topicsData = topicsData.filter(function (topic) {
      return !topic.deleted;
    });

    _async2.default.forEachOf(topicsData, function (topicData, i, next) {
      Topics.getMainPost(topicData.tid, uid, function (err, mainPost) {
        topicsData[i].post = mainPost;
        topicsData[i].date = getDate(topicsData[i].timestamp);
        topicsData[i].replies = (topicsData[i].postcount - 1)+' '+declOfNum(topicsData[i].postcount - 1, ['Ответ', 'Ответа', 'Ответов']);

        next();
      });
    }, function () {
      cb(null, topicsData);
    });
  });
}

function getAutoFeature(theirid, slug, next) {
  getListNameBySlug(theirid, slug, function (err, list) {
    if (err) return next(err);

    db.getSortedSetRange('fte:' + theirid + ':list:' + list + ':autofeature', 0, -1, next);
  });
}

function setAutoFeature(theirid, slug, autoFeature, next) {
  getListNameBySlug(theirid, slug, function (err, list) {
    if (err) return next(err);

    db.getSortedSetRange('fte:' + theirid + ':list:' + list + ':autofeature', 0, -1, function (err, cids) {
      if (err) return next(err);

      _async2.default.parallel([_async2.default.apply(_async2.default.each, cids, function (cid, next) {
        db.sortedSetRemove('fte:autofeature:' + cid, theirid + ':' + list, next);
      }), _async2.default.apply(db.delete, 'fte:' + theirid + ':list:' + list + ':autofeature')], function (err) {
        if (err) return next(err);

        _async2.default.each(autoFeature, function (cid, next) {
          if (!cid) return next();

          _winston2.default.info('Setting autofeature key \'fte:autofeature:' + cid + '\' value \'' + theirid + ':' + list + '\'');
          _winston2.default.info('Setting autofeature key \'fte:' + theirid + ':list:' + list + ':autofeature\' value \'' + cid + '\'');

          _async2.default.parallel([_async2.default.apply(db.sortedSetAdd, 'fte:autofeature:' + cid, 0, theirid + ':' + list, next), _async2.default.apply(db.sortedSetAdd, 'fte:' + theirid + ':list:' + list + ':autofeature', 0, cid)], next);
        }, next);
      });
    });
  });
}

// Hook filter:widgets.getAreas
// Add a widget areas for the news page.
function getAreas(areas, cb) {
  areas = areas.concat([{
    name: 'News Header',
    template: 'news.tpl',
    location: 'header'
  }, {
    name: 'News Sidebar',
    template: 'news.tpl',
    location: 'sidebar'
  }, {
    name: 'News Left Sidebar',
    template: 'news.tpl',
    location: 'leftsidebar'
  }, {
    name: 'News Footer',
    template: 'news.tpl',
    location: 'footer'
  }, {
    name: 'News Content Top',
    template: 'news.tpl',
    location: 'contenttop'
  }, {
    name: 'News Content Bottom',
    template: 'news.tpl',
    location: 'contentbottom'
  }, {
    name: 'News Content Between',
    template: 'news.tpl',
    location: 'contentbetween'
  }]);

  cb(null, areas);
}

// Hook filter:widgets.getWidgets
function getWidgets(widgets, callback) {
  var _widgets = [{
    widget: 'featuredTopicsExSidebar',
    name: 'Featured Topics Sidebar',
    description: 'Featured topics as a sidebar widget.',
    content: 'admin/widgets/fte-widget.tpl'
  }, {
    widget: 'featuredTopicsExBlocks',
    name: 'Featured Topics Blocks',
    description: 'Featured topics as Lavender-style blocks.',
    content: 'admin/widgets/fte-widget.tpl'
  }, {
    widget: 'featuredTopicsExCards',
    name: 'Featured Topics Cards',
    description: 'Featured topics as Persona-style topic cards.',
    content: 'admin/widgets/fte-widget-cards.tpl'
  }, {
    widget: 'featuredTopicsExList',
    name: 'Featured Topics List',
    description: 'Featured topics as a normal topic list.',
    content: 'admin/widgets/fte-widget.tpl'
  }, {
    widget: 'featuredTopicsExNews',
    name: 'Featured Topics News',
    description: 'Featured topics as a News/Blog page.',
    content: 'admin/widgets/fte-widget-news.tpl'
  }];

  _async2.default.each(_widgets, function (widget, next) {
    if (!widget.content.match('tpl')) return next();
    app.render(widget.content, {}, function (err, content) {
      translator.translate(content, function (content) {
        widget.content = content;
        next();
      });
    });
  }, function (err) {
    widgets = widgets.concat(_widgets);
    callback(null, widgets);
  });
}

function renderWidgetTopics(template, data, widget, next) {
  return function (err, topics) {
    if (err) {
      widget.html = '';
      return next(null, widget);
    }

    data.topics = topics;
    data.config = { relative_path: nconf.get('relative_path') };

    app.render(template, data, function (err, html) {
      return translator.translate(html, function (html) {
        widget.html = html;
        next(err, widget);
      });
    });
  };
}

// Hook filter:widget.render:featuredTopicsExSidebar
function renderFeaturedTopicsSidebar(widget, next) {
  var _widget$data = widget.data,
      slug = _widget$data.slug,
      sorted = _widget$data.sorted,
      max = _widget$data.max,
      sortby = _widget$data.sortby;
  var uid = widget.uid;


  var render = renderWidgetTopics('widgets/featured-topics-ex-sidebar', {}, widget, next);

  if (sorted) {
    var tids = sorted.replace(/ /g, '').split(',').map(function (i) {
      return parseInt(i, 10);
    });
    getTopicsWithMainPost(uid, tids, render);
  } else {
    getFeaturedTopicsBySlug(uid, 0, slug, 1, max, render);
  }
}

// Hook filter:widget.render:featuredTopicsExBlocks
function renderFeaturedTopicsBlocks(widget, next) {
  var _widget$data2 = widget.data,
      slug = _widget$data2.slug,
      sorted = _widget$data2.sorted,
      max = _widget$data2.max,
      sortby = _widget$data2.sortby;
  var uid = widget.uid;


  var render = renderWidgetTopics('widgets/featured-topics-ex-blocks', {}, widget, next);

  if (sorted) {
    var tids = sorted.replace(/ /g, '').split(',').map(function (i) {
      return parseInt(i, 10);
    });
    getTopicsWithMainPost(uid, tids, render);
  } else {
    getFeaturedTopicsBySlug(uid, 0, slug, 1, max, render);
  }
}

// Hook filter:widget.render:featuredTopicsExCards
function renderFeaturedTopicsCards(widget, next) {
  var _widget$data3 = widget.data,
      slug = _widget$data3.slug,
      sorted = _widget$data3.sorted,
      max = _widget$data3.max,
      sortby = _widget$data3.sortby;
  var uid = widget.uid;


  var render = renderWidgetTopics('widgets/featured-topics-ex-cards', {
    backgroundSize: widget.data.backgroundSize || 'cover',
    backgroundPosition: widget.data.backgroundPosition || 'center',
    backgroundOpacity: widget.data.backgroundOpacity || '1.0',
    textShadow: widget.data.textShadow || 'none'
  }, widget, next);

  var getPosts = function getPosts(topics, next) {
    _async2.default.each(topics, function (topic, next) {
      var tid = topic.tid;


      Topics.getTopicPosts(tid, 'tid:' + tid + ':posts', 0, 4, uid, true, function (err, posts) {
        topic.posts = posts;
        next(err);
      });
    }, function (err) {
      return next(err, topics);
    });
  };

  if (sorted) {
    var tids = sorted.replace(/ /g, '').split(',').map(function (i) {
      return parseInt(i, 10);
    });
    getTopicsWithMainPost(uid, tids, function (err, topics) {
      if (err) return render(err);
      getPosts(topics, render);
    });
  } else {
    getFeaturedTopicsBySlug(uid, 0, slug, 1, max, function (err, topics) {
      if (err) return render(err);
      getPosts(topics, render);
    });
  }
}

// Hook filter:widget.render:featuredTopicsExList
function renderFeaturedTopicsList(widget, next) {
  var _widget$data4 = widget.data,
      slug = _widget$data4.slug,
      sorted = _widget$data4.sorted,
      max = _widget$data4.max,
      sortby = _widget$data4.sortby;
  var uid = widget.uid;


  var render = renderWidgetTopics('widgets/featured-topics-ex-list', {}, widget, next);

  var getPosts = function getPosts(topics, next) {
    _async2.default.each(topics, function (topic, next) {
      var tid = topic.tid;


      Topics.getTopicPosts(tid, 'tid:' + tid + ':posts', 0, 4, uid, true, function (err, posts) {
        topic.posts = posts;
        next(err);
      });
    }, function (err) {
      return next(err, topics);
    });
  };

  if (sorted) {
    var tids = sorted.replace(/ /g, '').split(',').map(function (i) {
      return parseInt(i, 10);
    });
    getTopicsWithMainPost(uid, tids, function (err, topics) {
      if (err) return render(err);
      getPosts(topics, render);
    });
  } else {
    getFeaturedTopicsBySlug(uid, 0, slug, 1, max, function (err, topics) {
      if (err) return render(err);
      getPosts(topics, render);
    });
  }
}

// Hook filter:widget.render:featuredTopicsExNews
function renderFeaturedTopicsNews(widget, next) {
  var _widget$data5 = widget.data,
      slug = _widget$data5.slug,
      sorted = _widget$data5.sorted,
      max = _widget$data5.max,
      sortby = _widget$data5.sortby,
      template = _widget$data5.template;
  var uid = widget.uid;


  if (sorted) {
    var tids = sorted.replace(/ /g, '').split(',').map(function (i) {
      return parseInt(i, 10);
    });
    getTopicsWithMainPost(uid, tids, render);
  } else {
    getFeaturedTopicsBySlug(uid, 0, slug, 1, max, render);
  }

  function render(err, topics) {
    parseFeaturedPageTopics(template, topics, 1, false, false, false, { config: { relative_path: nconf.get('relative_path') } }, function (err, data) {
      widget.html = data.featuredTemplate;
      next(null, widget);
    });
  }
}

// Hook action:homepage.get:news
// Pass hook data to the render function.
function newsRender(data) {
  renderNewsPage(data.req, data.res, data.next);
}

// Hook filter:navigation.available
// Adds an available nav icon to admin page.
//death
function addNavs(items, cb) {
  items.push({
    route: '/news',
    title: 'Главные новости',
    enabled: false,
    iconClass: 'fa-newspaper-o',
    textClass: 'visible-xs-inline',
    text: 'Главные новости'
  });
  cb(null, items);
}

// Hook filter:admin.header.build
// Adds a link to the plugin settings page to the ACP Plugins menu.
function adminBuild(header, cb) {
  header.plugins.push({
    route: '/plugins/featured-topics-extended',
    icon: 'fa-newspaper-o',
    name: 'Featured Topics Extended'
  });
  cb(null, header);
}

// Hook filter:topic.thread_tools
// Adds the 'Feature this Topic' link to the 'Topic Tools' menu.
// death add
function addThreadTools(data, callback) {
  data.tools.push({
    title: 'Перенести в главные новости',
    class: 'mark-featured',
    icon: 'fa-star'
  });

  callback(null, data);
}

// Hook filter:post.tools
// Adds user thread feature link.
function addPostTools(data, callback) {
  Posts.isMain(data.pid, function (err, isMain) {
    if (err) {
      return callback(err);
    }

    if (isMain) {
      data.tools.push({
        action: 'mark-featured',
        html: 'Feature this Topic',
        icon: 'fa-star'
      });
    }

    callback(null, data);
  });
}

// Hook action:topic.post
// Auto-feature topics in the selected categories.
function topicPost(hookData) {
  var _hookData$topic = hookData.topic,
      tid = _hookData$topic.tid,
      cid = _hookData$topic.cid;


  db.getSortedSetRange('fte:autofeature:' + cid, 0, -1, function (err, data) {
    if (err) return _winston2.default.warn(err.message);

    _async2.default.each(data, function (datum, next) {
      datum = datum.split(':');

      if (datum.length !== 2) return;

      var theirid = datum[0];
      var list = datum[1];

      featureTopic(theirid, tid, list, next);
    });
  });
}

// Hook action:topic.delete
// Auto-feature topics in the selected categories.
function topicDelete(hookData) {
  var tid = hookData.topic.tid;


  db.getSortedSetRange('tid:' + tid + ':featured', 0, -1, function (err, data) {
    if (err) return _winston2.default.warn(err.message);

    _async2.default.each(data, function (datum, next) {
      datum = datum.split(':');

      if (datum.length !== 2) return;

      var theirid = datum[0];
      var list = datum[1];

      unfeatureTopic(theirid, tid, list, next);
    });
  });
}

// Hook filter:user.profileMenu
// Add links to private list management and public blog.
function userProfileMenu(data, next) {
  data.links = data.links.concat([{
    name: '[[fte:featuredtopics]]',
    id: 'fte-profilelink-featured',
    visibility: {
      self: true,
      other: false,
      moderator: false,
      globalMod: false,
      admin: false
    },
    route: 'featured',
    icon: 'fa-newspaper-o'
  }, {
    name: '[[fte:blog]]',
    id: 'fte-profilelink-blog',
    route: 'blog',
    icon: 'fa-newspaper-o'
  }]);

  next(null, data);
}

// Date parsing helper.
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function getDate(timestamp) {
  var date = new Date(parseInt(timestamp, 10));
  var hours = date.getHours();
  date = {
    full: months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear(),
    year: date.getFullYear(),
    month: months[date.getMonth()],
    date: date.getDate(),
    day: days[date.getDay()],
    mer: hours >= 12 ? 'PM' : 'AM',
    hour: hours === 0 ? 12 : hours > 12 ? hours - 12 : hours,
    min: date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes(),
    sec: date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds()
  };
  date.start = (Date.now() - parseInt(timestamp, 10)) / 1000 < 604800 ? date.day + ' at ' + date.hour + ':' + date.min + ' ' + date.mer : date.full;
  return date;
}

function buildWidgets(data, next) {
  getFeaturedTopicsLists(data.req.uid, 0, function (err, lists) {
    data.templateData.lists = lists;
    next(err, data);
  });
}

// Parse featured topics page using a template.
function parseFeaturedPage(uid, theirid, slug, page, size, template, data, next) {
  db.getObjectField('fte:' + theirid + ':lists:slugs', slug, function (err, list) {
    db.sortedSetCount('fte:' + theirid + ':list:' + list + ':tids', '-inf', '+inf', function (err, count) {
      var pageCount = Math.max(1, Math.ceil(count / size));
      page = parseInt(page, 10);
      var nextpage = page === pageCount ? false : page + 1;
      var prevpage = page === 1 ? false : page - 1;

      var pages = [];
      while (pageCount > 0) {
        pages.unshift({ number: pageCount, currentPage: pageCount === page });
        pageCount--;
      }

      getFeaturedTopicsBySlug(uid, theirid, slug, page, size, function (err, topics) {
        if (err) {
          _winston2.default.error('Error parsing news page:', err ? err.message || err : 'null');
          return next(null, '');
        }

        data.paginator = pages.length > 1;

        parseFeaturedPageTopics(template, topics, page, pages, nextpage, prevpage, data, next);
      });
    });
  });
}

function parseFeaturedPageTopics(template, topics, page, pages, nextpage, prevpage, data, next) {
  if (template !== 'custom') {
    app.render('news-' + template, _extends({}, data, { topics: topics, pages: pages, nextpage: nextpage, prevpage: prevpage }), function (err, html) {
      translator.translate(html, function (featuredTemplate) {
        next(null, { featuredTemplate: featuredTemplate, topics: topics, page: page, pages: pages, nextpage: nextpage, prevpage: prevpage });
      });
    });
  } else {
    var parsed = _templates2.default.parse(settings.get('customTemplate'), _extends({}, data, { topics: topics, pages: pages, nextpage: nextpage, prevpage: prevpage }));
    translator.translate(parsed, function (featuredTemplate) {
      featuredTemplate = featuredTemplate.replace('&#123;', '{').replace('&#125;', '}');
      next(null, { featuredTemplate: featuredTemplate, topics: topics, page: page, pages: pages, nextpage: nextpage, prevpage: prevpage });
    });
  }
}

function renderNewsPage(req, res) {
  var uid = req.uid;

  var template = settings.get('newsTemplate') || defaultSettings['newsTemplate'];
  var page = req.params.page || 1;
  var size = 5;
  var slug = 'news';

  if (!uid && settings.get('newsHideAnon')) return res.render('news', {});

  parseFeaturedPage(uid, GLOBALUID, slug, page, size, template, {
    config: {
      relative_path: nconf.get('relative_path')
    },
    featuredRoute: '/news/'
  }, function (err, data) {
    res.render('news', _extends({title: 'Главные новости'}, data));
  });
}

function renderBlogPage(req, res) {
  var uid = req.uid;

  var template = settings.get('newsTemplate') || defaultSettings['newsTemplate'];
  var page = req.params.page || 1;
  var size = 5;
  var slug = req.params.listslug || 'blog';

  accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, function (err, userData) {
    userData.title = userData.username + ' [[fte:blog]]';
    userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[fte:blog]]' }]);

    parseFeaturedPage(uid, userData.uid, slug, page, size, template, {
      config: {
        relative_path: nconf.get('relative_path')
      },
      featuredRoute: '/user/' + userData.userslug + '/' + slug + '/'
    }, function (err, data) {
      res.render('account/fte-blog', _extends({}, data, userData));
    });
  });
}
