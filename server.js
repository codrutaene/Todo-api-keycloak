var express = require('express');
var bodyParser = require('body-parser');
var _ = require('underscore');
var db = require('./db.js');
var bcrypt = require('bcrypt');
var middleware = require('./middleware.js')(db);

const session = require('express-session');
const Keycloak = require('keycloak-connect');

var memoryStore = new session.MemoryStore();
var keycloak = new Keycloak({});

var app = express();

app.use( keycloak.middleware() );

var PORT = process.env.PORT || 8000;
var todos = [];
var todoNextId = 1;

app.use(bodyParser.json());

app.get('/', function(req, res) {
	res.send('todo API root');
});

// GET /todos?completed=false&q=work
app.get('/todos', async function(req, res) {
	var query = req.query;
	var where = {};

	// console.log(req.kauth.grant.access_token.content.email);

	if (query.hasOwnProperty('completed') && query.completed === 'true') {
		where.completed = true;
	} else if (query.hasOwnProperty('completed') && query.completed === 'false') {
		where.completed = false;
	}

	if (query.hasOwnProperty('q') && query.q.length > 0) {
		where.description = {
			$like: '%' + query.q + '%'
		};
	}
	// not sure this is needed
	// if (query.hasOwnProperty('useremail') && query.useremail.length > 0) {
	// 	where.useremail = query.useremail;
	// }
	where.useremail = req.kauth.grant.access_token.content.email;

	try {
		let todos = await db.todo.findAll({
			where: where
		});
		res.json(todos);
	} catch (e){
		res.status(500).send();
	}		
});

// GET /todos/:id
app.get('/todos/:id', keycloak.protect(), async function(req, res) {
	var todoId = parseInt(req.params.id, 10);

	try{
		let todo = await db.todo.findOne({
			where : {
				id: todoId,
				useremail: req.kauth.grant.access_token.content.email
			}
		});

		if (!!todo) {
			res.json(todo.toJSON());
		} else {
			res.status(404).send();
		}

	} catch (e) {
		res.status(500).send();
	}
});

// POST /todos
app.post('/todos', keycloak.protect(), async function(req, res) {
	var body = _.pick(req.body, 'description', 'completed');
	//todo async await
	body.useremail = req.kauth.grant.access_token.content.email;
	try {
		let todo = await db.todo.create(body);
		res.json(todo.toJSON());
	} catch (e) {
		res.status(400).json(e);
	}
});

// DELETE /todos/:id
app.delete('/todos/:id', keycloak.protect(),async function(req, res) {
	var todoId = parseInt(req.params.id, 10);

	try {
		let rowsDeleted = await db.todo.destroy({
			where: {
				id: todoId,
				useremail: req.kauth.grant.access_token.content.email
			}
		});
		if (rowsDeleted === 0) {
			res.status(404).json({
				error: 'No todo with id'
			});
		} else {
			res.status(204).send();
		}
	} catch (e) {
		res.status(500).send();
	}
});

// PUT /todos/:id
app.put('/todos/:id', keycloak.protect(), async function(req, res) {
	var todoId = parseInt(req.params.id, 10);
	var body = _.pick(req.body, 'description', 'completed');
	var attributes = {};

	if (body.hasOwnProperty('completed')) {
		attributes.completed = body.completed;
	}

	if (body.hasOwnProperty('description')) {
		attributes.description = body.description;
	}

	try {
		let todo = await db.todo.findOne({
			where: {
				id: todoId,
				useremail: req.kauth.grant.access_token.content.email
			}
		});
		if (todo){
			try{
				let todo2 = await todo.update(attributes);
				res.json(todo2.toJSON());
			} catch(err){
				res.status(400).json(e);
			}			
		}else{
			res.status(404).send();
		}		
	} catch (e) {
		res.status(500).json(e);
	}
});

//{force: true}
db.sequelize.sync().then(function() {
	app.listen(PORT, function() {
		console.log('Express listening on port ' + PORT);
	})
});