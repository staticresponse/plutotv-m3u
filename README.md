# plutotv-m3u
Container Deployment for plutotv 


### Installation instructions.
If you have jellyfin already running... remove the jellyfin from the compose file (or add the plutotv block to your existing compose file)
The volume in the plutotv location should be somewhere where you have given jellyfin access.


Once you have done the container setup, you can set the plutotv as a live tv source
1. in jellyfin, navigate to web/#/dashboard/livetv
2. Click "add tuner device"
3. add the m3ud file that was created at the volumes location from the docker-compose.yml file
4. add a tv guide data provide. Use the xml file in that same location
5. Task complete. you now have pluto tv integrated into jellyfin. it may take a few minutes for the tv guide to populate properly