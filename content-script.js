(async () => {

    const APPLY_COOLDOWN = 1000;

    let lastAppliedTime = null;
    let lastAppliedAmount = 0;

    let db;

    const bannedChannels = new Set();
    const bannedVideos = new Set();

    async function isBannedChannel(db, channelId) {
        return (await db.get('bannedChannels', channelId)) != null;
    }

    async function isBannedVideo(db, videoId) {
        return (await db.get('bannedVideos', videoId)) != null;
    }

    async function loadData() {
        return await idb.openDB('youtube-sanitizer', 1, {
            upgrade(db) {
                console.debug('Updating database...');
                if (!db.objectStoreNames.contains('bannedChannels')) {
                    db.createObjectStore('bannedChannels', {keyPath: 'channelId'});
                    console.debug('Created object store bannedChannels');
                }
                if (!db.objectStoreNames.contains('bannedVideos')) {
                    db.createObjectStore('bannedVideos', {keyPath: 'videoId'});
                    console.debug('Created object store bannedVideos');
                }
            }
        });
    }

    function filterSearchResults(force = false) {

        //setTimeout(() => {

        console.log('Hello from content-script.js');

        // Remove recommended videos and shorts, this is a "search", not a promotion page!!
        const $shelfs = document.querySelectorAll(`ytd-shelf-renderer:not([class*='x-yts-']), ytd-reel-shelf-renderer:not([class*='x-yts-'])`);
        for (let $shelf of $shelfs) {
            const title = $shelf.querySelector('#title').textContent.trim();
            console.debug('[YTSanitizer] Hidding shelf ' + title);
            $shelf.classList.add('x-yts-search-result-hide-shelf');
        }

        // Resize thumbs
        const $thumbs = document.querySelectorAll('ytd-video-renderer[use-search-ui] ytd-thumbnail.ytd-video-renderer');
        for (let $thumb of $thumbs) {
            $thumb.style.maxWidth = '240px';
        }

        const videos = [];
        const $results = document.querySelectorAll(`ytd-video-renderer.ytd-item-section-renderer:not([class*='x-yts-'])`);

        if ($results.length === lastAppliedAmount && !force) {
            return;
        }
        lastAppliedAmount = $results.length;

        for (let $result of $results) {
            const $title = $result.querySelector('#video-title');
            const $channel = $result.querySelector('#channel-name #text a');
            const $link = $result.querySelector('#thumbnail');
            const $description = $result.querySelector('#description-text+div yt-formatted-string');
            const $channelLink = $result.querySelector('#channel-name a');

            const video = {
                title: $title.textContent.trim(),
                channel: $channel.textContent.trim(),
                link: $link.href,
                description: $description != null ? $description.textContent.trim() : '¿?¿?¿',
                channelLink: $channelLink.href.split('/').pop(),
                id: $link.href.replace(/^.+v=/, '').split('&')[0],
                $dom: $result
            };
            videos.push(video);

            const $chnlInfo = $result.querySelector('#channel-info');
            if ($chnlInfo.querySelector('.x-btn-ban-channel') == null) {
                // Append button to channel info
                const $btn = document.createElement('div');
                $btn.classList.add('x-btn-ban-channel');
                $btn.title = 'Ban channel "' + video.channel + '"';
                $btn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    //bannedChannels.add(video.channelLink);
                    db.add('bannedChannels', {
                        channelId: video.channelLink,
                        name: video.channel,
                        created: Date.now()
                    });
                    console.debug('[YTSanitizer] Channel ' + video.channel + ' marked as banned, refreshing filters...');
                    filterSearchResults(true);
                });
                $chnlInfo.appendChild($btn);
            }

            const $metadataLine = $result.querySelector('#metadata-line');
            if ($metadataLine.querySelector('.x-btn-ban-video') == null) {
                // Append button to metadata line
                const $btn = document.createElement('div');
                $btn.classList.add('x-btn-ban-video');
                $btn.title = 'Ban video ' + video.id;
                $btn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    //bannedVideos.add(video.id);
                    db.add('bannedVideos', {
                        videoId: video.id,
                        name: video.title,
                        created: Date.now()
                    });
                    console.debug('[YTSanitizer] Video ' + video.id + ' marked as banned, refreshing filters...');
                    filterSearchResults(true);
                });
                $metadataLine.appendChild($btn);
            }
        }
        for (let video of videos) {
            //video.$dom.classList.remove('x-yts-search-result-hide-video', 'x-yts-search-result-hide-channel');

            db.get('bannedChannels', video.channelLink).then((x) => {
                if (x != null) {
                    // video.$dom.style.height = '0';
                    // video.$dom.style.borderTop = '3px solid rgb(255 0 0 / 20%)';
                    // video.$dom.style.overflow = 'hidden';
                    video.$dom.classList.add('x-yts-search-result-hide-channel');
                    console.debug('[YTSanitizer] Hidding video ' + video.id + ' because channel ' + video.channel + ' is banned');
                }
            });
            db.get('bannedVideos', video.id).then((x) => {
                if (x != null) {
                    video.$dom.classList.add('x-yts-search-result-hide-video');
                    // video.$dom.style.height = '0';
                    // video.$dom.style.borderTop = '3px solid rgb(255 0 0 / 20%)';
                    // video.$dom.style.overflow = 'hidden';
                    console.debug('[YTSanitizer] Hidding video ' + video.id + ' because is banned');
                }
            });
        }

        //console.debug('videos -> ', videos);

        // setTimeout(() => {
        //     debugger
        //     console.log('Hello hllo -> ', document.querySelectorAll('ytd-video-renderer.style-scope.ytd-item-section-renderer'));
        //     document.querySelectorAll('ytd-video-renderer.style-scope.ytd-item-section-renderer').forEach(function (x) {
        //         x.style.opacity = '0.5';
        //     });
        //}, 5000);

        //document.querySelectorAll('ytd-video-renderer.style-scope.ytd-item-section-renderer');

        // chrome.scripting.executeScript({
        //     target: { tabId: tab.id },
        //     files: ["content-script.js"]
        // });

    }

    async function filterHomepage(force = false) {

        // Remove recommended videos and shorts, this is a "search", not a promotion page!!
        const $shelfs = document.querySelectorAll(`ytd-shelf-renderer:not([class*='x-yts-']), ytd-reel-shelf-renderer:not([class*='x-yts-']), ytd-rich-shelf-renderer:not([class*='x-yts-'])`);
        for (let $shelf of $shelfs) {
            const title = $shelf.querySelector('#title').textContent.trim();
            console.debug('[YTSanitizer] Hidding shelf ' + title);
            $shelf.classList.add('x-yts-homepage-hide-shelf');
        }

        const videos = [];
        const $results = [...document.querySelectorAll(`ytd-rich-item-renderer`)] //:not([class*='x-yts-'])
            .filter(x => x.querySelector('ytd-rich-grid-media.ytd-rich-item-renderer') != null);

        for (let $result of $results) {
            const $title = $result.querySelector('#video-title');
            const $channel = $result.querySelector('#channel-name #text a');
            const $link = $result.querySelector('#thumbnail');
            // const $description = (description is not available in homepage)
            const $channelLink = $result.querySelector('#channel-name a');

            if ($title == null || $channel == null || $link == null || $channelLink == null) {
                console.debug('[YTSanitizer] Invalid video found, skipping...', $result);
                continue;
            }

            const video = {
                title: $title.textContent.trim(),
                channel: $channel.textContent.trim(),
                link: $link.href,
                channelLink: $channelLink.href.split('/').pop(),
                id: $link.href.replace(/^.+v=/, '').split('&')[0],
                $dom: $result
            };
            videos.push(video);

            const $chnlInfo = $result.querySelector('#channel-name');
            // Add button to ban video
            if ($chnlInfo.querySelector('.x-btn-ban-video') == null) {
                // Append button to metadata line
                const $btn = document.createElement('div');
                $btn.classList.add('x-btn-ban-video');
                $btn.title = 'Ban video ' + video.id;
                $btn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    db.add('bannedVideos', {
                        videoId: video.id,
                        name: video.title,
                        created: Date.now()
                    });
                    console.debug('[YTSanitizer] Video ' + video.id + ' marked as banned, refreshing filters...');
                    filterSearchResults(true);
                });
                $chnlInfo.appendChild($btn);
            }
            // Add button to ban channel
            if ($chnlInfo.querySelector('.x-btn-ban-channel') == null) {
                // Append button to channel info
                const $btn = document.createElement('div');
                $btn.classList.add('x-btn-ban-channel');
                $btn.title = 'Ban channel "' + video.channel + '"';
                $btn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    db.add('bannedChannels', {
                        channelId: video.channelLink,
                        name: video.channel,
                        created: Date.now()
                    });
                    console.debug('[YTSanitizer] Channel ' + video.channel + ' marked as banned, refreshing filters...');
                    dispatch(true);
                });
                $chnlInfo.appendChild($btn);
            }
        }

        // Hide banned videos
        for (let video of videos) {
            if (await isBannedChannel(db, video.channelLink)) {
                if (!video.$dom.classList.contains('x-yts-homepage-hide-channel')) {
                    video.$dom.classList.add('x-yts-homepage-hide-channel');
                    console.debug('[YTSanitizer] Hidding video ' + video.id + ' because channel ' + video.channel + ' is banned');
                }
            } else if (await isBannedVideo(db, video.id)) {
                if (!video.$dom.classList.contains('x-yts-homepage-hide-video')) {
                    video.$dom.classList.add('x-yts-homepage-hide-video');
                    console.debug('[YTSanitizer] Hidding video ' + video.id + ' because is banned');
                }
            } else {
                video.$dom.classList.remove('x-yts-homepage-hide-video', 'x-yts-homepage-hide-channel');
            }
        }
    }

    function resetStyles() {
        document.querySelectorAll(`[class*='x-yts-']`).forEach((x) => {
            x.classList.remove('x-yts-search-result-hide-video', 'x-yts-search-result-hide-channel');
        });
        console.debug('[YTSanitizer] Reset done');
    }

    async function dispatch(force = false) {
        const now = Date.now();
        const url = window.location.href;
        if (url !== mUrl || lastAppliedTime == null || now - lastAppliedTime > APPLY_COOLDOWN) {
            console.debug('[YTSanitizer] Refreshing filters...');

            if (url !== mUrl) {
                console.debug('[YTSanitizer] URL changed, resetting styles...');
                resetStyles();
            }
            mUrl = url;

            try {
                if (location.pathname === '/results') {
                    console.debug('[YTSanitizer] Filtering search results...');
                    filterSearchResults(force);
                } else if (location.pathname === '/') {
                    console.debug('[YTSanitizer] Filtering homepage...');
                    await filterHomepage(force);
                }
            } catch (e) {
                console.error('[YTSanitizer] Error while applying filters: ', e);
            }
            lastAppliedTime = now;
        }
    }

    let mUrl = null;

    console.debug('[YTSanitizer] Initialized at ' + Date.now() + ' with URL ' + window.location.href);

    db = await loadData();
    const observer = new MutationObserver(async (mutations) => {
        //console.debug('[YTSanitizer] Mutation detected at ' + Date.now());

        // Check if there are new nodes
        const hasNewNodes = mutations.find((x) => x.type === 'childList' && x.addedNodes.length > 0) != null;
        if (hasNewNodes) {
            //console.debug('[YTSanitizer] New nodes detected, refreshing filters...');
            await dispatch();
        }
    });
    observer.observe(document.body, {attributes: false, childList: true, subtree: true});

})();