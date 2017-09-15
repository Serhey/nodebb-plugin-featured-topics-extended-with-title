'use strict';

$(function () {
  config.fte = {};

  app.loadJQueryUI(function () {
    function openModal(theirid, lists) {
      var _ajaxify$data = ajaxify.data,
          tid = _ajaxify$data.tid,
          title = _ajaxify$data.title;


      if (!tid) return console.log('No tid for featured topic modal.');

      templates.parse('modals/fte-listselect', { lists: lists, title: title }, function (html) {
        bootbox.dialog({
          size: 'large',
          title: 'Featuring topic: "' + title + '"',
          message: html,
          show: true,
          onEscape: true,
          buttons: {
            'cancel': {
              label: 'Cancel',
              className: 'btn-primary',
              callback: function callback() {}
            },
            'accept': {
              label: 'Add Topic',
              className: 'btn-default',
              callback: function callback() {
                socket.emit('plugins.FeaturedTopicsExtended.featureTopic', {
                  tid: tid,
                  theirid: theirid,
                  slug: $('#fte-topic-list-select').val()
                }, function (err) {
                  if (err) return app.alertError(err.message);

                  app.alertSuccess('Featured Topic');
                });
              }
            }
          }
        });
      });
    }

    function openTopicsListModal(theirid) {
      if ($('#featured-topics-ex-modal').length) return app.alertError('Already editing featured topics.');

      socket.emit('plugins.FeaturedTopicsExtended.getFeaturedTopicsLists', { theirid: theirid }, function (err, lists) {
        if (err) return app.alertError(err.message);
        if (!lists || !lists.length) return app.alertError('Unable to get featured topic lists.');

        openModal(theirid, lists);
      });
    }

    function registerEventHandlers() {
      $('.topic').on('click', '.thread-tools .mark-featured', function () {
        return openTopicsListModal();
      });
      $('[component="topic"]').on('click', '[component="mark-featured"]', function () {
        return openTopicsListModal(app.user.uid);
      });
    }

    $(window).on('action:ajaxify.end', registerEventHandlers);

    registerEventHandlers();
  });

  define('forum/account/fte-featured', ['forum/account/header'], function (header) {
    return {
      init: function init() {
        header.init();
        setupEditor(ajaxify.data.theirid);
      }
    };
  });

  define('forum/fte-featured', function () {
    return {
      init: function init() {
        setupEditor();
      }
    };
  });

  function setupEditor(theirid) {
    $('#fte-editor-list-add').click(function () {
      bootbox.prompt('Create a list', function (list) {
        if (!list) return;

        socket.emit('plugins.FeaturedTopicsExtended.createList', { theirid: theirid, list: list }, function (err) {
          if (err) {
            app.alertError(err.message);
          } else {
            app.alertSuccess('Created list <b>' + list + '</b>!');
            $('.fte-editor-list-select').append('<option value="' + list + '">' + list + '</option>');
          }
        });
      });
    });

    $('#fte-editor-list-delete').click(function () {
      var slug = $('.fte-editor-list-select').val();
      var list = $('option[value="' + slug + '"]').text();

      bootbox.confirm('Are you sure you want to delete the list <b>' + list + '</b>?', function (confirm) {
        if (!confirm) return;

        socket.emit('plugins.FeaturedTopicsExtended.deleteList', { theirid: theirid, slug: slug }, function (err) {
          if (err) return app.alertError(err.message);

          app.alertSuccess('Deleted list <b>' + list + '</b>!');

          $('.fte-editor-list-select [value="' + slug + '"]').remove();
          $('.fte-editor-list-select').val($('.fte-editor-list-select option').first().val());
          $('.fte-editor-list-select').change();
        });
      });
    });

    $('.fte-editor-list-select').change(function () {
      var slug = $(this).val();
      var page = 1;

      socket.emit('plugins.FeaturedTopicsExtended.getFeaturedTopics', { theirid: theirid, slug: slug, page: page }, function (err, data) {
        if (err) return app.alertError(err.message);

        app.parseAndTranslate('partials/fte-topic-list', { topics: data.topics, isSelf: ajaxify.data.isSelf }, function (html) {
          $('.fte-topic-list').html(html);
          $('.fte-topic-list').data('page', 1);
        });

        $('#fte-editor-list-autofeature').val(data.list.autoFeature.join(','));
      });
    });

    $('#fte-editor-list-autofeature-save').click(function () {
      var autoFeature = $('#fte-editor-list-autofeature').val();
      var slug = $('.fte-editor-list-select').val();

      socket.emit('plugins.FeaturedTopicsExtended.setAutoFeature', { theirid: theirid, slug: slug, autoFeature: autoFeature }, function (err, data) {
        if (err) return app.alertError(err.message);

        app.alertSuccess('Save auto feature');
      });
    });

    $('#fte-editor').on('click', '.fa-close', function () {
      var slug = $('.fte-editor-list-select').val();
      var tid = $(this).data('tid');
      var row = $(this).closest('tr');

      socket.emit('plugins.FeaturedTopicsExtended.unfeatureTopic', { theirid: theirid, slug: slug, tid: tid }, function (err, data) {
        if (err) return app.alertError(err.message);

        app.alertSuccess('Unfeatured topic');

        var page = $('.fte-topic-list').data('page');

        socket.emit('plugins.FeaturedTopicsExtended.getFeaturedTopics', { theirid: theirid, slug: slug, page: page }, function (err, data) {
          if (err) return app.alertError(err.message);
          if (!data || !data.topics || !data.topics.length) return;

          app.parseAndTranslate('partials/fte-topic-list', { topics: data.topics, isSelf: ajaxify.data.isSelf }, function (html) {
            $('.fte-topic-list').html(html);
          });
        });
      });
    });

    $('#fte-editor').on('click', '.fte-topics-list-prev', function () {
      var page = $('.fte-topic-list').data('page');
      if (page === 1) return;

      page--;
      var slug = $('.fte-editor-list-select').val();

      socket.emit('plugins.FeaturedTopicsExtended.getFeaturedTopics', { theirid: theirid, slug: slug, page: page }, function (err, data) {
        if (err) return app.alertError(err.message);
        if (!data || !data.topics || !data.topics.length) return;

        app.parseAndTranslate('partials/fte-topic-list', { topics: data.topics, isSelf: ajaxify.data.isSelf }, function (html) {
          $('.fte-topic-list').html(html);
          $('.fte-topic-list').data('page', page);
        });
      });
    });

    $('#fte-editor').on('click', '.fte-topics-list-next', function () {
      var page = $('.fte-topic-list').data('page');

      page++;
      var slug = $('.fte-editor-list-select').val();

      socket.emit('plugins.FeaturedTopicsExtended.getFeaturedTopics', { theirid: theirid, slug: slug, page: page }, function (err, data) {
        if (err) return app.alertError(err.message);
        if (!data || !data.topics || !data.topics.length) return;

        app.parseAndTranslate('partials/fte-topic-list', { topics: data.topics, isSelf: ajaxify.data.isSelf }, function (html) {
          $('.fte-topic-list').html(html);
          $('.fte-topic-list').data('page', page);
        });
      });
    });

    $('.fte-editor-list-select').val($('.fte-editor-list-select [selected]').val());
    $('#fte-editor-list-autofeature').val(ajaxify.data.list.autoFeature.join(','));
    $('.fte-topic-list').data('page', 1);
  }

  define('forum/account/fte-blog', ['forum/account/header'], function (header) {
    return {
      init: function init() {
        header.init();
      }
    };
  });
});