Moescript:asoi
==============

### Literals: use [] only
	def emptyObject = [:]
	def gameConfig = [
		player: [
			name: "tom"
			type: Human
			level: 1
			weapon: sword
			inventory: [food, food, potion, bomb]
		]
		enemy: [
			name: "Dragon"
			type: Dragon
			level: 9
		]
	]

### Currying, and `def` wrappers
	def Y(g) {
		// use "=" here...
		def rec(x)(y) = g(x(x)) y
		rec(rec) // ...means this value will be returned.
	}

	// Define recursive function using Y
	// fibonacci = Y(functon(recurse){return function(n){...}})
	def Y fibonacci(recurse)(n) {
		if(n <= 2) 1
		else recurse(n - 2) + recurse(n - 1)
	}

	fibonacci(5) // 5

### Simple "class" definition
	def Man(name) {
		this.name = name
		return nothing
	}
	def Man::speak(something) {
		trace something
		return nothing
	}

	def outof(Man) Child(name) {
		resend Man(name) // Man.call this, name
		return nothing
	}
	def Child::speak(something) {
		trace "Ah!"
		resend Man::speak(something) // Man.prototype.speak.call this, something
		return nothing
	}

	var tom = new Child "Tom"
	tom.speak "Thanks!"

### Monadic transformation for async / enumerator / list comprehension......
Asyncs

	def async randPrintNums(n) {
		def tasks = []
		for(i <- 0..n) {
			tasks.push async {
				sleep ! (100 * Math.random())
				trace index
			} 
			where { index = i }
		}
		join! tasks
	}

	randPrintNums 100

Enumerators

	def enumeration String::getEnumerator() {
		for(i <- 0..this.length) {
			enumeration.yield! this.charAt(i), i
		}
		return nothing
	}

	for(c <- "this is a string") {
		trace c
	}

List comprehension

	-- Enumerator comprehension monad
	var ecSchemata = object defaultMonadSchemata, {
		def Enumerable @return(x) {
			if(x != undefined) {
				enumeration.yield! x
			}
			return nothing
		}
		def @bindYield(f, thisp, args) = f.apply thisp, arguments.slice(2)
		def Enumerable @bind(list, callback) {
			for(x <- list) {
				for(y <- callback x) {
					enumeration.yield! y
				}
			}
			return nothing
		}
	}

	var mktable(G) {
		f.apply(this, arguments)()
		where { f = G.build ecSchemata }
	}

	// simple usage
	for(item <- mktable {var x <- (1..100); x * 2 + 1}) trace item
	
	// complicated usage
	var t = mktable {var x <- (1...9); var y <- (x...9); x + ' * ' + y + ' = ' + x * y }
	// t = mktable [build: fBuild]
	// where fBuild(schemata)()() =
	//     schemata.bind (1...9), (x) =>
	//         schemata.bind (x...9), (y) =>
	//             schemata.return (x + ' * ' + y + ' = ' + x * y)
	for(item <- t) trace item