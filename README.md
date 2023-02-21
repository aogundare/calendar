# ScheduleMe
ScheduleMe is a calendar application that allows keeping track of events, and sharing them with friends. The website runs using a NodeJS server and PostgreSQL, with all the required files in the root directory of this repository. All webpage views and other resources are also located in their respective folders in the root directory. There also exists a folder containing all Project Milestones.

# Testing Instructions
To run the application locally with Docker, the command "docker-compose up" will set up and start the necessary components (The command "docker-compose run web npm install" may also be required to install additional NodeJS modules). From there, the website will be hosted at "localhost:3000". By default, the PostgreSQL database contains a user with email "test@test.com" and password "test" that can be used to test all of the application's account and event features.