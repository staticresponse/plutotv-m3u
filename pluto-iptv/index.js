#!/usr/bin/env node

const request = require('request');
const j2x = require('jsontoxml');
const moment = require('moment');
const fs = require('fs-extra');
const uuid4 = require('uuid').v4;
const uuid1 = require('uuid').v1;
const favorites = require('./favorites');

const plutoIPTV = {
  grabJSON: function (callback) {
    callback = callback || function () {};

    console.log('[INFO] Grabbing EPG...');

    // check for cache
    if (fs.existsSync('cache.json')) {
      let stat = fs.statSync('cache.json');

      let now = new Date() / 1000;
      let mtime = new Date(stat.mtime) / 1000;

      // it's under 30 mins old
      if (now - mtime <= 1800) {
        console.log("[DEBUG] Using cache.json, it's under 30 minutes old.");

        callback(false, fs.readJSONSync('cache.json'));
        return;
      }
    }

    let startTime = encodeURIComponent(
      moment().format('YYYY-MM-DD HH:00:00.000ZZ')
    );

    let stopTime = encodeURIComponent(
      moment().add(48, 'hours').format('YYYY-MM-DD HH:00:00.000ZZ')
    );

    let apiUrl = `http://api.pluto.tv/v2/channels?start=${startTime}&stop=${stopTime}`;

    console.log(apiUrl);

    request(apiUrl, function (err, response, raw) {
      if (err) {
        callback(err);
        return;
      }

      console.log('[DEBUG] Using api.pluto.tv, writing cache.json.');
      fs.writeFileSync('cache.json', raw);

      callback(false, JSON.parse(raw));
    });
  },
};

module.exports = plutoIPTV;

plutoIPTV.grabJSON(function (err, channels) {
  if (err) {
    console.error('[ERROR]', err);
    process.exit(1);
  }

  /////////////////////
  // Filter Channels //
  /////////////////////
  const favoritesPath = './pluto-favorites';
  const favoritesFilter = favorites.from(favoritesPath);

  if (!favoritesFilter.isEmpty()) {
    channels = channels.filter(favoritesFilter);
    favoritesFilter.printSummary();
  } else {
    console.log(
      `[DEBUG] No favorites specified (${favoritesPath}), loading all channels.`
    );
  }

  ///////////////////
  // M3U Playlist //
  ///////////////////

  let m3u = '#EXTM3U\n';

  channels.forEach((channel) => {
    let deviceId = uuid1();
    let sid = uuid4();

    if (channel.isStitched) {
      let m3uUrl = new URL(channel.stitched.urls[0].url);

      // FIXED: use m3uUrl.search instead of url.search
      let queryString = m3uUrl.search;
      let params = new URLSearchParams(queryString);

      params.set('advertisingId', '');
      params.set('appName', 'web');
      params.set('appVersion', 'unknown');
      params.set('appStoreUrl', '');
      params.set('architecture', '');
      params.set('buildVersion', '');
      params.set('clientTime', '0');
      params.set('deviceDNT', '0');
      params.set('deviceId', deviceId);
      params.set('deviceMake', 'Chrome');
      params.set('deviceModel', 'web');
      params.set('deviceType', 'web');
      params.set('deviceVersion', 'unknown');
      params.set('includeExtendedEvents', 'false');
      params.set('sid', sid);
      params.set('userId', '');
      params.set('serverSideAds', 'true');

      m3uUrl.search = params.toString();
      m3uUrl = m3uUrl.toString();

      let slug = channel.slug;
      let logo = channel.colorLogoPNG.path;
      let group = channel.category;
      let name = channel.name;

      m3u += `#EXTINF:-1 tvg-id="${slug}" tvg-logo="${logo}" group-title="${group}",${name}
${m3uUrl}

`;

      console.log('[INFO] Adding ' + channel.name + ' channel.');
    } else {
      console.log("[DEBUG] Skipping 'fake' channel " + channel.name + '.');
    }
  });

  ///////////////////////////
  // XMLTV Programme Guide //
  ///////////////////////////

  let tv = [];

  channels.forEach((channel) => {
    if (channel.isStitched && channel.timelines) {
      channel.timelines.forEach((programme) => {
        console.log(
          '[INFO] Adding instance of ' +
            programme.title +
            ' to channel ' +
            channel.name +
            '.'
        );

        tv.push({
          name: 'programme',
          attrs: {
            start: moment(programme.start).format('YYYYMMDDHHmmss ZZ'),
            stop: moment(programme.stop).format('YYYYMMDDHHmmss ZZ'),
            channel: channel.slug,
          },
          children: [
            {
              name: 'title',
              attrs: { lang: 'en' },
              text: programme.title,
            },
            {
              name: 'sub-title',
              attrs: { lang: 'en' },
              text:
                programme.title === programme.episode.name
                  ? ''
                  : programme.episode.name,
            },
            {
              name: 'desc',
              attrs: { lang: 'en' },
              text: programme.episode.description,
            },
            {
              name: 'date',
              text: moment(programme.episode.firstAired).format('YYYYMMDD'),
            },
            {
              name: 'category',
              attrs: { lang: 'en' },
              text: programme.episode.genre,
            },
            {
              name: 'category',
              attrs: { lang: 'en' },
              text: programme.episode.subGenre,
            },
            {
              name: 'category',
              attrs: { lang: 'en' },
              text: programme.episode.series.type,
            },
            {
              name: 'category',
              attrs: { lang: 'en' },
              text: channel.category,
            },
            {
              name: 'episode-num',
              attrs: { system: 'onscreen' },
              text: programme.episode.number,
            },
            {
              name: 'icon',
              attrs: { src: programme.episode.poster.path },
            },
          ],
        });
      });
    }

    tv.push({
      name: 'channel',
      attrs: {
        id: channel.slug,
      },
      children: [
        {
          name: 'display-name',
          text: channel.name,
        },
        {
          name: 'display-name',
          text: channel.number,
        },
        {
          name: 'desc',
          text: channel.summary,
        },
        {
          name: 'icon',
          attrs: {
            src: channel.colorLogoPNG.path,
          },
        },
      ],
    });
  });

  let epg = j2x(
    { tv },
    {
      prettyPrint: true,
      escape: true,
    }
  );

  fs.writeFileSync('epg.xml', epg);
  console.log('[SUCCESS] Wrote the EPG to epg.xml!');

  // Changed from playlist.m3u8
  fs.writeFileSync('playlist.m3u8', m3u);
  console.log('[SUCCESS] Wrote the playlist to playlist.m3u!');
});