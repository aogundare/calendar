//Load Components
var express = require('express'); //Ensure our express framework has been added
var bodyParser = require('body-parser'); //Ensure our body-parser tool has been added
var app = express();
app.use(bodyParser.json());              // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var store = require('store') // used for local storage
const PORT = process.env.PORT || 3000;

//Create Database Connection
var pgp = require('pg-promise')();

//Database Connection information
const dev_dbConfig = {
	host: 'db',
	port: 5432,
	database: process.env.POSTGRES_DB,
	user:  process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD
};

/** If we're running in production mode (on heroku), the we use DATABASE_URL
 * to connect to Heroku Postgres.
 */
const isProduction = process.env.NODE_ENV === 'production';
const dbConfig = isProduction ? process.env.DATABASE_URL : dev_dbConfig;

// Heroku Postgres patch for v10
// fixes: https://github.com/vitaly-t/pg-promise/issues/711
if (isProduction) {
  pgp.pg.defaults.ssl = {rejectUnauthorized: false};
}

var db = pgp(dbConfig);

// set the view engine to ejs
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/'));//This line is necessary for us to use relative paths and access our resources directory


// LOGIN PAGE
app.get('/login', function(req, res) {
	res.render('pages/login',{
		local_css:"login.css",
		my_title:"Login",
		user: store.get('user'),
		error:""
	});
});

// LOGIN PAGE: Logging in
app.post('/login', function(req, res) {
	let email = req.body.email;
	let password = req.body.password;
	let query = `select * from accounts where email_address = '${email}';`
	
	db.any(query)
	.then(function(rows) {
		if (!rows[0]) {
			loginError(res, "User does not exist!");
		} else if (rows[0]["pass_hash"] !== password) {
			loginError(res, "Incorrect Password!");
		} else {
			// Logged in.
			// Set UserID to local storage for future use.
			store.set('user', rows[0]);
			res.redirect(302, '/');
		}
	})
	.catch(function(err) {
		console.log(err);
		loginError(res, "Database error.");
	});
});

// LOGIN PAGE: Error handling
function loginError(res, err) {
	res.render('pages/login',{
		local_css:"login.css",
		my_title:"Login",
		user: store.get('user'),
		error: err
	});
}





// REGISTRATION PAGE
app.get('/register', function(req, res) {
	res.render('pages/register',{
		local_css:"register.css",
		my_title:"Registration",
		user: store.get('user'),
		error:''
	});
});

// REGISTRATION PAGE: Add account
app.post('/register', function(req, res) {
	let name = req.body.name;
	let email = req.body.email;
	let password = req.body.password;
	
	// Query 1: ensure user does not already exist
	let query = `select * from accounts where email_address = '${email}';`
	db.any(query)
	.then(function(rows) {
		if (rows[0]) {
			registerError(res, "User already exists.");
		} else {

			// Query 2: store new user information in database
			let query2 = `insert into accounts(user_id, user_name, email_address, pass_hash, shared_ids)
						values((select max(user_id) from accounts)+1, '${name}', '${email}', '${password}', ARRAY[]::int[]);`
			db.any(query2)
			.then(function(rows) {

				// Query 3: retrieve new user information
				let query3 = `select * from accounts where user_id = (select max(user_id) from accounts);`
				db.any(query3)
				.then(function(rows) {
					// Logged in.
					// Set UserID to local storage for future use.
					store.set('user', rows[0]);
					res.redirect(302, '/');
				})
				.catch(function(err) {
					console.log(err);
					registerError(res, "Database error.");
				});
			})
			.catch(function(err) {
				console.log(err);
				registerError(res, "Database error.");
			});
		}
	})
	.catch(function(err) {
		console.log(err);
		registerError(res, "Database error.");
	});
});

// REGISTRATION PAGE: Error handling
function registerError(res, err) {
	res.render('pages/register',{
		local_css:"register.css",
		my_title:"Registration",
		user: store.get('user'),
		error: err
	});
}



//ACCOUNT PAGE
app.get('/account', function(req, res){
	var user = store.get('user');
	if (user) {
		let shared_ids = user["shared_ids"]
		if (shared_ids.length == 0) {
			shared_ids = -1;
		}
		// Query 1: Get user's friends
		var query1 = `select user_id, user_name, email_address from accounts where user_id = ANY(ARRAY[${shared_ids}]);`
		db.any(query1)
		.then(function (friends) {
			// Query 2: Get upcoming events
			var query2 = `select * from events where user_id = ${user["user_id"]} order by start_time limit 4;`;
			db.any(query2)
			.then(function (events) {
				res.render('pages/account',{
					local_css: "account.css",
					my_title: "Account Page",
					user: store.get('user'),
					friends: friends,
					events: events,
					error: ''
				});
			})
			.catch(function (err) {
				console.log(err);
				accountError(res, "Database error.");
			});
		})
		.catch(function (err) {
			console.log(err);
			accountError(res, "Database error.");
		});
	} else { 
		accountError(res, "Not logged in!");
	}
});

// ACCOUNT PAGE: Edit account
app.post('/edit_account', function(req, res) {
	var newEmail = req.body.email;
	var newUsername = req.body.username;
	var newPassword = req.body.password;
	var user = store.get('user');
	if (user) {
		// Query 1: update account information
		var query1 = `update accounts set user_name = '${newUsername}', email_address = '${newEmail}', pass_hash = '${newPassword}' where user_id = ${user.user_id};`;
		db.any(query1)
		.then(function (rows) {
			// Query 2: retrieve new user information
			let query2 = `select * from accounts where user_id = ${user["user_id"]};`
			db.any(query2)
			.then(function(rows) {
				// Logged in.
				// Set UserID to local storage for future use.
				store.set('user', rows[0]);
				res.redirect(302, '/account');
			})
			.catch(function(err) {
				console.log(err);
				registerError(res, "Database error.");
			});
		})
		.catch(function (err) {
			console.log(err);
			accountError(res, "Database error.");
		});
	} else { 
		accountError(res, "Not logged in!");
	}
});

//ACCOUNT PAGE: add friend to list
app.post('/add_friend', function(req, res){
	var user = store.get('user');
	if (user) {
		var friend_email = req.body.friend_email;
		// Query 1: Get person by email
		var query1 = `select * from accounts where email_address = '${friend_email}';`;
		db.any(query1)
		.then(function (rows) {
			if(rows && rows.length > 0){
				let shared_ids = user.shared_ids;
				shared_ids.push(rows[0]["user_id"]);

				// Query 2: Add person to friends list
				query2 = `update accounts set shared_ids = ARRAY[${shared_ids}]::int[] where user_id = ${user.user_id};`;
				db.any(query2)
				.then(function (rows) {
					// Query 3: retrieve new user information
					let query3 = `select * from accounts where user_id = ${user["user_id"]};`
					db.any(query3)
					.then(function(rows) {
						// Logged in.
						// Set UserID to local storage for future use.
						store.set('user', rows[0]);
						res.redirect(302, '/account');
					})
					.catch(function(err) {
						console.log(err);
						registerError(res, "Database error.");
					});
				})
				.catch(function (err) {
					console.log(err);
					accountError(res, "Database error.");
				});
			}else{
				accountError(res, "Error: user does not exist!");
			}
		}).catch(function (err){
			console.log(err);
			accountError(res, "Database error.");
		});
	} else { 
		accountError(res, "Not logged in!");
	}
});

// ACCOUNT PAGE: Removing friends
app.get('/remove_friend/:id', function(req, res) {
	var user = store.get('user');
	if (user) {
		let friend_id = req.params.id;
		let shared_ids = user["shared_ids"];
		let remove_index = -1;
		for (let index = 0; index < shared_ids.length; index++) {
			if (shared_ids[index] == friend_id) {
				remove_index = index;
			}
		}
		if (remove_index == -1) {
			calendarError(res, "Friend does not exist!");
		} else {
			shared_ids.splice(remove_index, 1);
			// Query 1: update account information
			query1 = `update accounts set shared_ids = ARRAY[${shared_ids}]::int[] where user_id = ${user.user_id};`;
			db.any(query1)
			.then(function(rows) {
				// Query 2: retrieve new user information
				let query2 = `select * from accounts where user_id = ${user["user_id"]};`
				db.any(query2)
				.then(function(rows) {
					// Logged in.
					// Set UserID to local storage for future use.
					store.set('user', rows[0]);
					res.redirect(302, '/account');
				})
				.catch(function(err) {
					console.log(err);
					registerError(res, "Database error.");
				});
			})
			.catch(function(err) {
				console.log(err);
				calendarError(res, "Database Error.");
			});
		}
	} else { 
		accountError(res, "Not logged in!");
	}
});

// ACCOUNT PAGE: Error handling
function accountError(res, err) {
	res.render('pages/account', {
		local_css: "account.css",
		my_title: "Account",
		user: store.get('user'),
		friends: '',
		events: '',
		error: err
	});
}




// CALENDAR PAGE
app.get('/', function(req, res) {
	var user = store.get('user');
	if (user) { // logged in
		let shared_ids = user["shared_ids"]
		if (shared_ids.length == 0) {
			shared_ids = -1;
		}
		// Query 1: Get event information
		var query1 = `select * from events where user_id = ANY(ARRAY[${user["user_id"]}, ${shared_ids}]);`
		db.any(query1)
		.then(function (rows1) {
			// Query 2: Get friend information
			var query2 = `select user_id, user_name from accounts where user_id = ANY(ARRAY[${shared_ids}]);`
			db.any(query2)
			.then(function (rows2) {
				res.render('pages/calendar',{
					local_css: "calendar.css",
					my_title: "ScheduleMe",
					user: store.get('user'),
					data: rows1,
					friends: rows2,
					week: 0,
					error: ''
				});
			})
			.catch(function (err) {
				console.log(err);
				calendarError(res, "Database error.");
			});
		})
		.catch(function (err) {
			console.log(err);
			calendarError(res, "Database error.");
		});
		
	} else { // not logged in
		res.render('pages/calendar',{
			local_css: "calendar.css",
			my_title: "ScheduleMe",
			user: store.get('user'),
			data: '',
			friends: '',
			week: 0,
			error: ''
		});
	}
});

// CALENDAR PAGE: Adding events
app.post('/add_event', function(req, res) {
	var user = store.get('user');
	if (user) { // logged in
		let event_name = req.body.event_name;
		let start_date = req.body.start_date;
		let start_time = req.body.start_time;
		let end_date = req.body.end_date;
		let end_time = req.body.end_time;
		let color = req.body.color;

		if (!event_name || !start_date || !start_time || !end_date || !end_time || !color) {
			calendarError(res, "Error: missing input!");
		} else {

			let query = `insert into events(event_id, user_id, start_time, end_time, event_name, color)
					values((select coalesce(max(event_id),0) from events)+1, ${user["user_id"]}, '${start_date} ${start_time}', '${end_date} ${end_time}', '${event_name}', '${color}');`
		
			db.any(query)
			.then(function(rows) {
				res.redirect(302, '/');
			})
			.catch(function(err) {
				console.log(err);
				calendarError(res, "Database error.");
			});
		}
	} else { // not logged in
		calendarError(res, "Error: Not logged in!");
	}
});

// CALENDAR PAGE: Updating events
app.post('/edit_event/:id', function(req, res) {
	var user = store.get('user');
	if (user) { // logged in
		let event_id = req.params.id;

		let event_name = req.body.event_name;
		let start_date = req.body.start_date;
		let start_time = req.body.start_time;
		let end_date = req.body.end_date;
		let end_time = req.body.end_time;
		let color = req.body.color;

		if (!event_name || !start_date || !start_time || !end_date || !end_time || !color) {
			calendarError(res, "Error: missing input!");
		} else {
			let query = `update events set start_time = '${start_date} ${start_time}', end_time = '${end_date} ${end_time}', event_name = '${event_name}', color = '${color}' where event_id = ${event_id};`
			
			db.any(query)
			.then(function(rows) {
				res.redirect(302, '/');
			})
			.catch(function(err) {
				console.log(err);
				calendarError(res, "Database error.");
			});
		}
	} else { // not logged in
		calendarError(res, "Error: not logged in!");
	}
});

// CALENDAR PAGE: Removing events
app.get('/remove_event/:id', function(req, res) {
	let event_id = req.params.id;
	let query = `delete from events where event_id = ${event_id}`
	
	db.any(query)
	.then(function(rows) {
		res.redirect(302, '/');
	})
	.catch(function(err) {
		console.log(err);
		calendarError(res, "Database Error.");
	});
});

//CALENDAR PAGE: Error handling
function calendarError(res, err) {
	res.render('pages/calendar',{
		local_css:"calendar.css",
		my_title:"ScheduleMe",
		user: store.get('user'),
		data: '',
		friends: '',
		week: 0,
		error: err
	});
}




// Logout from account
app.get('/logout', function(req, res) {
	store.remove('user');
	res.redirect(302, '/');
});

module.exports = app.listen(PORT);
console.log(`${PORT} is the magic port`);