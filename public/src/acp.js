'use strict';

(function () {
  function init(panel) {
    var group = panel.find('.fte-list-group');

    if (!group.length) return;
    if (group.find('option').length) return;

    app.parseAndTranslate('partials/fte-list-select', { lists: ajaxify.data.lists }, function (html) {
      group.html(html);
    });

    if (!!panel.find('[name="sorted"]').val()) $('.fte-topics-sort').text('Use All Topics');
  }

  function resort(panel) {
    var slug = panel.find('.fte-editor-list-select').val();

    app.loadJQueryUI(function () {
      socket.emit('plugins.FeaturedTopicsExtended.getFeaturedTopics', { uid: app.user.uid, theirid: 0, slug: slug }, function (err, data) {
        if (err) return app.alertError(err.message);

        app.parseAndTranslate('modals/fte-topics-sort', { topics: data.topics }, function (html) {
          var box = bootbox.confirm({
            title: 'Topic Order',
            message: $('<a>').append(html).html(),
            callback: function callback(confirm) {
              if (!confirm) return;

              var tids = [];
              box.find('.featured-topic').each(function (i) {
                tids.push(this.getAttribute('data-tid'));
              });
              if (!tids.length) return;
              tids = tids.join(',');

              panel.find('[name="sorted"]').val(tids);
              panel.find('.fte-topics-sort').text('Use All Topics');
            }
          }).on("shown.bs.modal", function () {
            $('span.timeago').timeago();
            $('.fte-sort-featured').sortable().disableSelection();

            $('.delete-featured').on('click', function () {
              $(this).parents('.panel').remove();
            });
          });
        });
      });
    });
  }

  $(window).on('action:ajaxify.end', function (event, data) {
    if (data.url.match('admin/extend/widgets')) {
      $('.widget-area').on('mouseup', '> .panel > .panel-heading', function () {
        init($(this).parent());
      });

      $('.widget-area').on('click', '.fte-topics-sort', function () {
        var panel = $(this).closest('.panel');

        if (panel.find('[name="sorted"]').val()) {
          panel.find('[name="sorted"]').val('');
          panel.find('.fte-topics-sort').text('Use Specific Topics');
        } else {
          resort(panel);
        }
      });
    }
  });
})();