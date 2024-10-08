var MAX_SPEED = 5;
var MAX_FORCE = 0.1;
var DESIRED_SEPARATION = 40;
var MOUSE_DESIRED_SEPARATION = 200;
var OBSTACLE_DESIRED_SEPARATION = 200;
var NEIGHBOR_DISTANCE = 60;
var BORDER_OFFSET = 10;
var EPSILON = 0.0000001;
var render_size = 10;
var death_throws = 0;
var avoidanceMultiplier = 2;



function Boid(x, y, simulation, leader = false) {
	var randomAngle = Math.random() * 2 * Math.PI;
	this.velocity = new Vector(Math.cos(randomAngle), Math.sin(randomAngle));
	this.position = new Vector(x, y);
	this.acceleration = new Vector(0, 0);
	this.simulation = simulation;
	this.render_size = render_size;
	this.death_throws = death_throws;
	this.sabateur = false;
	this.leader = leader;
}

Boid.prototype = {

	render: function () {
        var sizeMultiplier = this.leader ? 1.5 : .8; // Increase the size for the leader
        var directionVector = this.velocity.normalize().multiplyBy(this.render_size * sizeMultiplier);
        var inverseVector1 = new Vector(- directionVector.y, directionVector.x);
        var inverseVector2 = new Vector(directionVector.y, - directionVector.x);
        inverseVector1 = inverseVector1.divideBy(3);
        inverseVector2 = inverseVector2.divideBy(3);

        this.simulation.ctx.beginPath();
        this.simulation.ctx.moveTo(this.position.x, this.position.y);
        this.simulation.ctx.lineTo(this.position.x + inverseVector1.x, this.position.y + inverseVector1.y);
        this.simulation.ctx.lineTo(this.position.x + directionVector.x, this.position.y + directionVector.y);
        this.simulation.ctx.lineTo(this.position.x + inverseVector2.x, this.position.y + inverseVector2.y);
        this.simulation.ctx.lineTo(this.position.x, this.position.y);
        this.simulation.ctx.strokeStyle = 'rgba(88, 47, 14, .2)';
        this.simulation.ctx.stroke();
        if (this.leader) {
            this.simulation.ctx.fillStyle = 'rgba(65, 72, 51, 1)'; // Green color for the leader
        } else {
            this.simulation.ctx.fillStyle = 'rgba(88, 47, 14, .2)'; // Brown color for non-leaders
        }
        this.simulation.ctx.fill();
    },

	//
	// Rule 1: Boids try to fly towards the centre of mass of neighbouring boids, with non-leaders very attracted to leaders.
	getCohesionVector: function (boids) {
		var totalPosition = new Vector(0, 0);
		var leaderPosition = new Vector(0, 0);
		var neighborCount = 0;
		var leaderCount = 0;
		var nonLeaderCohesionIntensity = this.leader ? 0.2 : 1.5; // Leaders are less likely to fly towards other boids, non-leaders are less attracted to non-leaders
		var leaderCohesionIntensity = this.leader ? 0.2 : 2.5; // Non-leaders are significantly more attracted to leaders

		for (var bi in boids) {
			var boid = boids[bi];
			if (this == boid) {
				continue;
			}

			var distance = this.position.getDistance(boid.position) + EPSILON;
			if (boid.leader) {
				if (distance <= NEIGHBOR_DISTANCE * 2) { // Non-leaders are very attracted to leaders
					leaderPosition = leaderPosition.add(boid.position);
					leaderCount++;
				}
			} else if (distance <= NEIGHBOR_DISTANCE * nonLeaderCohesionIntensity) { // Adjusting distance for non-leaders to other non-leaders
				totalPosition = totalPosition.add(boid.position);
				neighborCount++;
			}
		}

		if (leaderCount > 0) {
			var averageLeaderPosition = leaderPosition.divideBy(leaderCount);
			return this.seek(averageLeaderPosition, leaderCohesionIntensity); // Non-leaders are very attracted to the average position of leaders
		} else if (neighborCount > 0) {
			var averagePosition = totalPosition.divideBy(neighborCount);
			return this.seek(averagePosition, nonLeaderCohesionIntensity); // Adjusting seek behavior for non-leaders to other non-leaders
		} else {
			return new Vector(0, 0);
		}
	},

	seek: function (targetPosition, intensity = 1) {
		var desiredVector = targetPosition.subtract(this.position);

		// Scale to the maximum speed, adjusted by intensity for leaders and attraction to leaders
		desiredVector.iSetMagnitude(MAX_SPEED * intensity);

		// Steering = Desired minus Velocity
		var steeringVector = desiredVector.subtract(this.velocity);
		steeringVector = steeringVector.limit(MAX_FORCE * intensity); // Adjusting force for leaders and attraction to leaders

		return steeringVector;
	},

	//
	// Rule 2: Boids try to keep a small distance away from other objects (including other boids).
	getSeparationVector: function (boids) {

		var steeringVector = new Vector(0, 0);
		var neighborCount = 0;

		for (var bi in boids) {
			var boid = boids[bi];
			if (this == boid) {
				continue;
			}

			var distance = this.position.getDistance(boid.position) + EPSILON;
			if (distance > 0 && distance < DESIRED_SEPARATION) {
				var deltaVector = this.position.subtract(boid.position);
				deltaVector.iNormalize();
				deltaVector.iDivideBy(distance);
				steeringVector.iAdd(deltaVector);
				neighborCount++;
			}
		}

		if (neighborCount > 0) {
			var averageSteeringVector = steeringVector.divideBy(neighborCount);
		} else {
			var averageSteeringVector = new Vector(0, 0);
		}

		var distance = this.position.getDistance(mouse_position) + EPSILON;
		if (distance > 0 && distance < MOUSE_DESIRED_SEPARATION && this.simulation.avoid_mouse) {
			var deltaVector = this.position.subtract(mouse_position);
			deltaVector.iNormalize();
			deltaVector.iDivideBy(distance ** 2);
			deltaVector.iMultiplyBy(5000);
			averageSteeringVector.iAdd(deltaVector);
		}

		for (var ob in this.simulation.obstacles) {
			var obstacle = this.simulation.obstacles[ob];

			var distance = this.position.getDistance(obstacle.position) + EPSILON;
			if (distance > 0 && distance < OBSTACLE_DESIRED_SEPARATION) {
				var deltaVector = this.position.subtract(obstacle.position);
				deltaVector.iNormalize();
				deltaVector.iDivideBy(distance);
				steeringVector.iAdd(deltaVector);
				if (this.sabateur) {
					deltaVector.iMultiplyBy(-obstacle.repulsion);
				} else {
					deltaVector.iMultiplyBy(obstacle.repulsion);
				}
				averageSteeringVector.iAdd(deltaVector);
			}
		}



		if (averageSteeringVector.getMagnitude() > 0) {
			averageSteeringVector.iSetMagnitude(MAX_SPEED);
			averageSteeringVector.iSubtract(this.velocity);
			averageSteeringVector.iLimit(MAX_FORCE);
		}

		return averageSteeringVector;
	},

	//
	// Rule 3: Boids try to match velocity with near boids.
	getAlignmentVector: function (boids) {
		var perceivedFlockVelocity = new Vector(0, 0);
		var neighborCount = 0;

		for (var bi in boids) {
			var boid = boids[bi];
			if (this == boid) {
				continue;
			}
	
			var distance = this.position.getDistance(boid.position) + EPSILON;
			if (distance > 0 && distance < NEIGHBOR_DISTANCE) {
				
				perceivedFlockVelocity.iAdd(boid.velocity);
				
				neighborCount++;
			}
		}

		if (neighborCount > 0) {
			var averageVelocity = perceivedFlockVelocity.divideBy(neighborCount);
			averageVelocity.iSetMagnitude(MAX_SPEED);
	
			var steeringVector = averageVelocity.subtract(this.velocity);
			steeringVector.iLimit(MAX_FORCE);
		
			return steeringVector;
		} else {
			return new Vector(0, 0);
		}
	},

	flock: function (boids) {
		var cohesionVector = this.getCohesionVector(boids);
		var separationVector = this.getSeparationVector(boids);
		var alignmentVector = this.getAlignmentVector(boids);

		separationVector.iMultiplyBy(this.simulation.separationMultiplier);
		cohesionVector.iMultiplyBy(this.simulation.cohesionMultiplier);
		alignmentVector.iMultiplyBy(this.simulation.alignmentMultiplier);

		this.acceleration.iAdd(cohesionVector);
		this.acceleration.iAdd(separationVector);
		this.acceleration.iAdd(alignmentVector);
	},

	bound: function () {

		if (this.position.x > this.simulation.canvasWidth + BORDER_OFFSET) {
			this.position.x = -BORDER_OFFSET;
		}

		if (this.position.x < -BORDER_OFFSET) {
			this.position.x = this.simulation.canvasWidth + BORDER_OFFSET;
		}

		if (this.position.y > this.simulation.canvasHeight + BORDER_OFFSET) {
			this.position.y = -BORDER_OFFSET;
		}

		if (this.position.y < -BORDER_OFFSET) {
			this.position.y = this.simulation.canvasHeight + BORDER_OFFSET;
		}
	},

	update: function () {
		if (this.death_throws == 0) {
			this.velocity.iAdd(this.acceleration);

			// Limit speed
			this.velocity.iLimit(MAX_SPEED);

			this.position.iAdd(this.velocity);
			this.bound();

			// Reset accelertion to 0 each cycle
			this.acceleration.iMultiplyBy(0);
		}
	},

	run: function (boids) {
		this.flock(boids);
		this.update();
		this.render();
	},

	set_death_throws: function () {
		this.death_throws = 50;
	},

	decrease_death_throws: function () {
		this.death_throws = this.death_throws - 1;
	},

	set_sabateur: function (b) {
		this.sabateur = b;
	},

}
	;
