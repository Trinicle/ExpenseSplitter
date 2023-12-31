var rhit = rhit || {};

rhit.FB_COLLECTION_BILL = "Bills";
rhit.FB_COLLECTION_INDIVIDUAL = "Individuals";
rhit.FB_COLLECTION_GROUP = "Groups";
rhit.FB_KEY_NAME = "name";
rhit.FB_KEY_DESCRIPTION = "description";
rhit.FB_KEY_AMOUNT = "amount";
rhit.FB_KEY_FROM = "from";
rhit.FB_KEY_TO = "to";
rhit.FB_KEY_PICTURE = "picture";
rhit.FB_KEY_FUNDS = "funds";
rhit.FB_KEY_INDIVIDUALS = "individuals";
rhit.FB_KEY_ID = "id";
rhit.FB_KEY_FRIENDS = "friends";


rhit.fbAccountManager = null;
rhit.AccountPageController = null;


function htmlToElement(html) {
	var template = document.createElement('template');
	html = html.trim();
	template.innerHTML = html;
	return template.content.firstChild;
}

rhit.fbIndividualManager = class {
  constructor() {
    this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_INDIVIDUAL);
    this._documentSnapshots = [];
    this._unsubscribe = null;
  }

  beginListening(changeListener) {
    let query = this._ref;
    this._unsubscribe = query.onSnapshot((querySnapshot) => {
      this._documentSnapshots = querySnapshot.docs;
      changeListener();
   });
  }
  stopListening() {   
		this._unsubscribe();
	}
  get length() {    
		return this._documentSnapshots.length;
	}
  getIndividualAtIndex(index) {  
		const docSnapshot = this._documentSnapshots[index];  
		const individual = new rhit.Individual(docSnapshot);
		return individual;
	}
}

rhit.Individual = class {
  constructor(docSnapshot) {
    this.funds = docSnapshot.get(rhit.FB_KEY_FUNDS);
    this.name = docSnapshot.get(rhit.FB_KEY_NAME);
    this.picture = docSnapshot.get(rhit.FB_KEY_PICTURE);
    this.friends = docSnapshot.get(rhit.FB_KEY_FRIENDS);
    this.docSnapshot = docSnapshot;
  }
}

rhit.FinancePageController = class {
  constructor() {
    document.querySelector("#deposit-button").onclick = (event) => {
      const funds = document.querySelector("#funds-field").value;
      if(Number(funds) > 0) {
        rhit.fbAccountManager.updateFunds(funds);
      } else {
        console.error("Amount is less than 0");
      }
    }
    document.querySelector("#withdraw-button").onclick = (event) => {
      const funds = document.querySelector("#funds-field").value;
      if(Number(funds) > 0 && Number(+rhit.fbAccountManager.funds - +funds) >= 0) {
        rhit.fbAccountManager.updateFunds(-1*funds);
      } else {
        console.error("Cannot withdraw funds");
      }    
    }
    rhit.fbAccountManager.beginListening(this.updateNavBar.bind(this));
    rhit.fbFinanceManager.beginListening(this.updateView.bind(this));
    rhit.fbFinanceManager.beginListening(this.updateChart.bind(this));
  }

  updateNavBar() {
    document.querySelectorAll("#current-balance").forEach((element) => element.innerHTML = `$${parseFloat(rhit.fbAccountManager.funds).toFixed(2)}`);
  }
  updateChart() {
    let billName = document.querySelectorAll("#bill-title-to-you");
    let billAmount = document.querySelectorAll("#bill-amount-to-you");
    
    let map = new Map();

    let billArray = [];
    billArray.push(['Expense', 'Bills']);
    for(let i = 0; i < billName.length; i++) {
      if(map.has(billName[i].innerHTML)) {
        let amount = map.get(billName[i].innerHTML);
        map.set(billName[i].innerHTML, Number(billAmount[i].innerHTML.replace("$","")) + amount);
      } else {
        map.set(billName[i].innerHTML, Number(billAmount[i].innerHTML.replace("$","")));
      }
    }

    for (const [name, value] of map) {
      billArray.push([ name, value ]);
  }

    console.log(billArray);

    
    // Piechart script: documentation @ https://developers.google.com/chart/interactive/docs/gallery/piechart
    google.charts.load('current', {'packages':['corechart']});
    google.charts.setOnLoadCallback(() => {

      var data = google.visualization.arrayToDataTable(billArray);
      
      var options = {
        fontName: 'Roboto',
      };
      var chart = new google.visualization.PieChart(document.getElementById('piechart'));
      chart.draw(data, options);
    });
  }
  updateView() {
    const oldList = document.querySelector(".card-history");
    while (oldList.firstChild) {
      oldList.removeChild(oldList.lastChild);
    }
    const yourOldList = document.querySelector(".card-your-bills");
    while (yourOldList.firstChild) {
      yourOldList.removeChild(yourOldList.lastChild);
    }
    for(let i = 0; i < rhit.fbFinanceManager.length; i++) {
      const bill = rhit.fbFinanceManager.getBillAtIndex(i);
      const newcard = this._createBill(bill);
      const billsByYou = this._createYourBill(bill);
      if(bill.to == rhit.fbAuthManager.uid) {
        oldList.appendChild(newcard);
        newcard.addEventListener("click", (event) => this.billEventListeners(bill)); 
      }
      if(bill.from == rhit.fbAuthManager.uid) {
        yourOldList.appendChild(billsByYou);
        billsByYou.addEventListener("click", (event) => this.yourBillEventListener(bill));
      }
    }
  }

  _createBill(bill) {
      return htmlToElement(
        `
        <button class="card-button" data-bs-toggle="modal" data-bs-target="#payExpenseModal" data-bs-whatever="@mdo">
          <div class="card-columns">
            <div class="card" id="finance-card">
              <div class="card-body">
                <h5 class="card-title" id="bill-title-to-you">${bill.from}</h5>
                <p class="card-text"><small class="text-muted">${bill.description}</small></p>
              </div>
              <div class="vl-holder">
                <hr class="vl" id="bill-vl">
              </div>
              <div class="card-amount">
                <p class="amount" id="bill-amount-to-you">$${parseFloat(bill.amount).toFixed(2)}</p>
              </div>
          </div>
        </div>
      </button>`
      );
  } 
  
  _createYourBill(bill) {
    return htmlToElement(
      `
      <button class="card-button" data-bs-toggle="modal" data-bs-target="#editExpenseModal" data-bs-whatever="@mdo">
        <div class="card-columns">
          <div class="card" id="finance-card">
            <div class="card-body">
              <h5 class="card-title">${bill.to}</h5>
              <p class="card-text"><small class="text-muted">${bill.description}</small></p>
            </div>
            <div class="vl-holder">
              <hr class="vl" id="bill-vl">
            </div>
            <div class="card-amount">
              <p class="amount" id="bill-amount">$${parseFloat(bill.amount).toFixed(2)}</p>
            </div>
        </div>
      </div>
    </button>`
    );
  }

  billEventListeners(bill) {
    document.querySelector("#pay-expense-amount").defaultValue = bill.amount;
    document.querySelector("#payBill").onclick = (event) => {
      const amount = document.querySelector("#pay-expense-amount").value;
      if(amount > 0) {
        rhit.fbFinanceManager.payBill(bill, amount);
        document.querySelector("#pay-expense-amount").defaultValue = "";
      } else {
        console.error("Amount is less than 0");
      }
    }
  }

  yourBillEventListener(bill) {
    document.querySelector("#edit-expense-recipients").defaultValue = bill.to.toString();
    document.querySelector("#edit-expense-description").defaultValue = bill.description;
    document.querySelector("#edit-expense-amount").defaultValue = bill.amount;
    document.querySelector("#deleteBill").onclick = (event) => {
      rhit.fbFinanceManager.deleteBill(bill.docSnapshot.id);
    }
    document.querySelector("#editBill").onclick = (event) => {
      const person = document.querySelector("#edit-expense-recipients").value;
      const description = document.querySelector("#edit-expense-description").value;
      const amount = document.querySelector("#edit-expense-amount").value;
      if(amount > 0) {
        rhit.fbFinanceManager.updateBill(amount, person, description, bill.docSnapshot.id);
      } else {
        console.error("Amount is less than 0");
      }
    }
  }
}

rhit.fbFinanceManager = class {
  constructor() {
    this._refBill = firebase.firestore().collection(rhit.FB_COLLECTION_BILL);

    this._documentSnapshotsBill = [];

    this._unsubscribe = null;
  }
  beginListening(changeListener) {
    let query = this._refBill;
    this._unsubscribe = query.onSnapshot((querySnapshot) => {
      this._documentSnapshotsBill = querySnapshot.docs;
      changeListener();
   });
  }
  stopListening() {   
		this._unsubscribe();
	}
  get length() {    
		return this._documentSnapshotsBill.length;
	}
  getBillAtIndex(index) {  
		const docSnapshot = this._documentSnapshotsBill[index];  
		const bill = new rhit.Bill(docSnapshot);
		return bill;
	}
  async payBill(bill, amount) {
    amount = parseFloat(amount).toFixed(2);
    const refto = firebase.firestore().collection(rhit.FB_COLLECTION_INDIVIDUAL).doc(bill.to);
    const reffrom = firebase.firestore().collection(rhit.FB_COLLECTION_INDIVIDUAL).doc(bill.from);

    await refto.get().then((doc) => {
      const data = doc.data();
      if(Number(+data.funds - +amount) < 0) {
        throw new Error("INSUFFICIENT FUNDS");
      }
    }).catch((error) => {
      return Promise.reject(error);
    });

    await refto.get().then((doc) => {
      const data = doc.data();
      refto.update(rhit.FB_KEY_FUNDS, +data.funds - +amount);
    }).catch((error) => {
      console.error("User: " + bill.to +" does not exist.")
    });
    await reffrom.get().then((doc) => {
      const data = doc.data();
      reffrom.update(rhit.FB_KEY_FUNDS, +data.funds + +amount);
    }).catch((error) => {
      console.error("User: " + bill.from +" does not exist.")
    });
    if(bill.amount - amount == 0) {
      this.deleteBill(bill.docSnapshot.id);
    } else {
      this.updateBill(bill.amount - amount, bill.to, bill.description, bill.docSnapshot.id);
      bill.amount = parseFloat(bill.amount - amount).toFixed(2);
    }
  }
  deleteBill(id) {
    this._refBill.doc(id).delete();
  }
  updateBill(amount, persons, description, id) {
    amount = parseFloat(amount).toFixed(2);
    this._refBill.doc(id).update(rhit.FB_KEY_AMOUNT, amount);
    this._refBill.doc(id).update(rhit.FB_KEY_TO, persons);
    this._refBill.doc(id).update(rhit.FB_KEY_DESCRIPTION, description);
  }
}

rhit.Bill = class {
  constructor(docSnapshot) {
    this.docSnapshot = docSnapshot;
    this.amount = docSnapshot.get(rhit.FB_KEY_AMOUNT);
    this.description = docSnapshot.get(rhit.FB_KEY_DESCRIPTION);
    this.to = docSnapshot.get(rhit.FB_KEY_TO);
    this.from = docSnapshot.get(rhit.FB_KEY_FROM);
  }
}

rhit.ExpensePageController = class {
  constructor() {

    document.querySelector("#group-confirm").onclick = (event) => {
      const individuals = document.querySelector("#group-individuals-list").value;
      const groupMembers = individuals.split(',');
      groupMembers.push(rhit.fbAuthManager.uid);
      const name = document.querySelector("#group-name").value;
      const description = document.querySelector("#group-description").value;
      const picture = document.querySelector("#group-picture").value;
      rhit.fbGroupManager.add(name, description, groupMembers, picture);
    }

    document.querySelector("#deposit-button").onclick = (event) => {
      const funds = document.querySelector("#funds-field").value;
      if(Number(funds) > 0) {
        rhit.fbAccountManager.updateFunds(funds);
      } else {
        console.error("Amount is less than 0");
      }
    }
    document.querySelector("#withdraw-button").onclick = (event) => {
      const funds = document.querySelector("#funds-field").value;
      if(Number(funds) > 0 && Number(+rhit.fbAccountManager.funds - +funds) > 0) {
        rhit.fbAccountManager.updateFunds(-1*funds);
      } else {
        console.error("Cannot withdraw funds");
      }    
    }

    document.querySelector("#individual-add").onclick = (event) => {
      const friend = document.querySelector("#individual-name").value;
      rhit.fbAccountManager.addFriend(friend)
    }
    
    rhit.fbAccountManager.beginListening(this.updateNavBar.bind(this));
    rhit.fbGroupManager.beginListening(this.updateGroupList.bind(this));
    rhit.fbIndividualManager.beginListening(this.updateIndividualList.bind(this));
  }

  updateNavBar() {
    document.querySelectorAll("#current-balance").forEach((element) => element.innerHTML = `$${parseFloat(rhit.fbAccountManager.funds).toFixed(2)}`);
  }

  async updateGroupList() {
    const groupList = htmlToElement('<div class="card-groups"></div>');
    for(let i = 0; i < rhit.fbGroupManager.length; i++) {
      const group = rhit.fbGroupManager.getGroupAtIndex(i);
      const id = rhit.fbAuthManager.uid;
      if(this.inGroup(id,group)) {
        const newcard = await this._createGroup(group);
        groupList.appendChild(newcard);
        newcard.addEventListener("click", (event) => this.groupCardEventListeners(group, id)); 
      }
    }
    const oldList = document.querySelector(".card-groups");
    oldList.removeAttribute("class");
    oldList.hidden = true;
    oldList.parentElement.appendChild(groupList);
  }

  inGroup(id, group) {
    return group.individuals.includes(id);
  }

  async _createGroup(group) {
    return htmlToElement(
      `<button class="card-button" data-bs-toggle="modal" data-bs-target="#addModal" data-bs-whatever="@mdo" id="">
        <div class="card-columns">
          <div class="card" id="expense-card">
            <div class="card-image">
              <img class="card-img-top" src="${group.picture}" alt="Group Image">
            </div>
            <div class="card-body">
              <h5 class="card-title">${group.name}</h5>
              <p class="card-text"><small class="text-muted">${group.description.slice(0,20) + (group.description.length > 20 ? "..." : "")}</small></p>
            </div>
            <div class="card-amount">
              <p class="amount">$${await this.totalAmount(group.docSnapshot.id)}</p>
            </div>
          </div>
        </div>
      </button>`
    );
  }

  async updateIndividualList() {
    const individualList = htmlToElement('<div class="card-individuals"></div>');
    for(let i = 0; i < rhit.fbIndividualManager.length; i++) {
      const individual = rhit.fbIndividualManager.getIndividualAtIndex(i);
      // TODO if id in friends then display
      const newcard = await this._createIndividual(individual);
      const id = rhit.fbAuthManager.uid;
      if(individual.friends.includes(id)) {
        individualList.appendChild(newcard);
        newcard.addEventListener("click", (event) => this.individualCardEventListeners(individual, id)); 
      }
    }
    const oldList = document.querySelector(".card-individuals");
    oldList.removeAttribute("class");
    oldList.hidden = true;
    oldList.parentElement.appendChild(individualList);
  }

  async _createIndividual(individual) {
    return htmlToElement(
      `<button class="card-button" data-bs-toggle="modal" data-bs-target="#addModal" data-bs-whatever="@mdo">
      <div class="card-columns">
        <div class="card" id="expense-card">
          <div class="card-image">
            <img class="card-img-top" src="${individual.picture}" alt="Card image cap">
          </div>
          <div class="card-body">
            <h5 class="card-title">${individual.name}</h5>
          </div>
          <div class="card-amount">
            <p class="amount">$${await this.totalAmount(individual.docSnapshot.id)}</p>
          </div>
        </div>
      </div>
    </button>
      `
    )
  }

  async totalAmount(id) {
    const ref = firebase.firestore().collection(rhit.FB_COLLECTION_INDIVIDUAL).doc(rhit.fbAuthManager.uid).collection(rhit.FB_COLLECTION_BILL).get();
    let result = await ref.then((snapshot) => {
      let total = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if(id == data.id) {
          total += data.amount;
        }
      });
      return total;
    });
    return result;
  }

  individualCardEventListeners(individual, id) {
    document.querySelector("#sendBill").onclick = (event) => {
      const person = document.querySelector("#add-expense-recipients").value;
      const description = document.querySelector("#add-expense-description").value;
      const amount = document.querySelector("#add-expense-amount").value;
      if(amount > 0) {
        this._createBill(amount, id, person, description);
      } else {
        console.error("Amount is less than 0");
      }
    }

    const ref = firebase.firestore().collection(rhit.FB_COLLECTION_INDIVIDUAL).doc(individual.docSnapshot.id).get();
    ref.then(snap => {
      const data = snap.data();
        document.querySelector("#add-expense-recipients").defaultValue = individual.docSnapshot.id;
  });
  }

  groupCardEventListeners(group, id) {
    document.querySelector("#sendBill").onclick = (event) => {
      const individuals = document.querySelector("#add-expense-recipients").value;
      const groupMembers = individuals.split(',');
      const description = document.querySelector("#add-expense-description").value;
      const amount = document.querySelector("#add-expense-amount").value;
      if(amount > 0) {
        let amountforEach = amount/groupMembers.length;
        groupMembers.forEach((member) => {
          this._createBill(parseFloat(amountforEach).toFixed(2), id, member, description);
        });
      } else {
        console.error("Amount is less than 0");
      }
    }

    const ref = firebase.firestore().collection(rhit.FB_COLLECTION_GROUP).doc(group.docSnapshot.id).get();
    ref.then(snap => {
      const data = snap.data();
        document.querySelector("#add-expense-recipients").defaultValue = data.individuals.toString();
  });
  }

  _createBill(amount, from, members, description) {
    const ref = firebase.firestore().collection(rhit.FB_COLLECTION_BILL)
    ref.add({
      [rhit.FB_KEY_AMOUNT]: amount,
      [rhit.FB_KEY_FROM]: from,
      [rhit.FB_KEY_TO]: members,
      [rhit.FB_KEY_DESCRIPTION]: description,
    });
  }
}

rhit.Group = class {
  constructor(docSnapshot) {
    this.description = docSnapshot.get(rhit.FB_KEY_DESCRIPTION);
    this.individuals = docSnapshot.get(rhit.FB_KEY_INDIVIDUALS);
    this.name = docSnapshot.get(rhit.FB_KEY_NAME);
    this.picture = docSnapshot.get(rhit.FB_KEY_PICTURE);
    this.docSnapshot = docSnapshot;
  }
}

rhit.fbGroupManager = class {
  constructor() {
    this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_GROUP);
    this._documentSnapshots = [];
    this._unsubscribe = null;
  }

  add(name, description, individuals, picture) {
    this._ref.add({
      [rhit.FB_KEY_DESCRIPTION]: description,
      [rhit.FB_KEY_INDIVIDUALS]: individuals,
      [rhit.FB_KEY_NAME]: name,
      [rhit.FB_KEY_PICTURE]: picture,
    });
  }
  beginListening(changeListener) {
    let query = this._ref;
    this._unsubscribe = query.onSnapshot((querySnapshot) => {
      this._documentSnapshots = querySnapshot.docs;
      changeListener();
   });
  }
  stopListening() {   
		this._unsubscribe();
	}
  get length() {    
		return this._documentSnapshots.length;
	}
  getGroupAtIndex(index) {  
		const docSnapshot = this._documentSnapshots[index];  
		const group = new rhit.Group(docSnapshot);
		return group;
	}
}

rhit.AccountPageController = class {
  constructor() {
    document.querySelector("#signOut").onclick = (event) => {
      rhit.fbAuthManager.signOut();
    }
    document.querySelector("#submitChangeName").onclick = (event) => {
      const name = document.querySelector("#account-name").value;
      rhit.fbAccountManager.updateName(name);
    }
    document.querySelector("#submitChangeProfilePicture").onclick = (event) => {
      const profile = document.querySelector("#account-picture").value;
      rhit.fbAccountManager.updatePicture(profile);
    }
    document.querySelector("#deposit-button").onclick = (event) => {
      const funds = document.querySelector("#funds-field").value;
      if(Number(funds) > 0) {
        rhit.fbAccountManager.updateFunds(funds);
      } else {
        console.error("Amount is less than 0");
      }
    }
    document.querySelector("#withdraw-button").onclick = (event) => {
      const funds = document.querySelector("#funds-field").value;
      if(Number(funds) > 0 && Number(+rhit.fbAccountManager.funds - +funds) > 0) {
        rhit.fbAccountManager.updateFunds(-1*funds);
      } else {
        console.error("Cannot withdraw funds");
      }    
    }

    rhit.fbAccountManager.beginListening(this.updateAccount.bind(this));
  }

  updateAccount() {
    document.querySelectorAll("#current-balance").forEach((element) => element.innerHTML = `$${rhit.fbAccountManager.funds}`);
  }
}

rhit.fbAccountManager = class {
  constructor() {
    this._unsubscribe = null;
    this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_INDIVIDUAL).doc(rhit.fbAuthManager.uid); //uid is the username such as freelahr
    this._documentSnapshot = {};
  }

  beginListening(changeListener) {
		this._unsubscribe = this._ref.onSnapshot((doc) => {
			if(doc.exists) {
				this._documentSnapshot = doc;
				changeListener();
			} else {
        this._ref.set({
          [rhit.FB_KEY_FUNDS]: 0,
          [rhit.FB_KEY_NAME]: rhit.fbAuthManager.uid,
          [rhit.FB_KEY_PICTURE]: "https://www.getfoundquick.com/wp-content/uploads/2014/01/Capture-1.jpg", 
          [rhit.FB_KEY_FRIENDS]: new Array(),
        });
			}
		});
	}
  stopListening() {
	  this._unsubscribe();
	}
  updateName(name) {
    this._ref.update(rhit.FB_KEY_NAME, name)
		.then(function () {
		})
		.catch(function (error) {
			console.error("Error ", error);
		});
  }
  updateFunds(funds) {
    funds = parseFloat(funds).toFixed(2);
    this._ref.update(rhit.FB_KEY_FUNDS, +this.funds + +funds)
		.then(function () {
		})
		.catch(function (error) {
			console.error("Error ", error);
		});
  }
  updatePicture(picture) {
    this._ref.update(rhit.FB_KEY_PICTURE, picture)
		.then(function () {
		})
		.catch(function (error) {
			console.error("Error ", error);
		});
  }
  addFriend(friend) {
    let temp = this.friends;
    temp.push(friend);
    const ref = firebase.firestore().collection(rhit.FB_COLLECTION_INDIVIDUAL).doc(friend);
    ref.get().then((doc) => {
      const data = doc.data();
      let temp2 = data.friends;
      temp2.push(rhit.fbAuthManager.uid);
      ref.update(rhit.FB_KEY_FRIENDS, temp2)
    })
    this._ref.update(rhit.FB_KEY_FRIENDS, temp)
  }

  get friends() {
    return this._documentSnapshot.get(rhit.FB_KEY_FRIENDS);
  }

  get funds() {
    return this._documentSnapshot.get(rhit.FB_KEY_FUNDS);
  }

  get name() {
    return this._documentSnapshot.get(rhit.FB_KEY_NAME);
  }

  get picture() {
    return this._documentSnapshot.get(rhit.FB_KEY_PICTURE);
  }
}
 
rhit.LoginPageController = class {
  constructor() {
    document.querySelector("#rosefireButton").onclick = (event) => {
      rhit.fbAuthManager.signIn();
    };
  }
}
 
rhit.fbAuthManager = class {
  constructor() {
    this._user = null;
  }
 
  beginListening(changeListener) {
    firebase.auth().onAuthStateChanged((user) => {
      this._user = user;
      changeListener();
    });
  }
 
  signIn() {
    console.log("Sign in using Rosefire");
    Rosefire.signIn("d419f334-d32e-4faa-b9ec-b436cffd442e", (err, rfUser) => {
      if (err) {
        console.log("Rosefire error!", err);
        return;
      }
      console.log("Rosefire success!", rfUser);
      firebase.auth().signInWithCustomToken(rfUser.token).catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        if (errorCode === 'auth/invalid-custom-token') {
          alert('The token you provided is not valid.');
        } else {
          console.error("Custom auth error", errorCode, errorMessage);
        }
      });
    });
  }
 
  signOut() {
    firebase.auth().signOut().then(() => {
      console.log("You are now signed out");
    }).catch((error) => {
      console.log("Sign out error");
    });
  }
  get isSignedIn() {
    return !!this._user;
  }
  get uid() {
    return this._user.uid;
  }
  get user() {
    return this._user;
  }
}
 
rhit.checkForRedirects = function () {
  if (document.querySelector("#loginPage") && rhit.fbAuthManager.isSignedIn) {
    window.location.href = "/finance.html"
  }
 
  if (!document.querySelector("#loginPage") && !rhit.fbAuthManager.isSignedIn) {
    window.location.href = "/"
  }
}
 
rhit.initializePage = function () {
  if(rhit.fbAuthManager.isSignedIn) {
    rhit.fbAccountManager = new rhit.fbAccountManager(rhit.fbAuthManager.user);
    rhit.fbIndividualManager = new rhit.fbIndividualManager();
    rhit.fbGroupManager = new rhit.fbGroupManager();
  }
  if (document.querySelector("#financePage")) {
    rhit.fbFinanceManager = new rhit.fbFinanceManager();
    new rhit.FinancePageController();
  }
 
  if (document.querySelector("#expensePage")) {
    new rhit.ExpensePageController();
  }
 
  if (document.querySelector("#accountPage")) {
    new rhit.AccountPageController();
  }
}

rhit.main = function () {
	console.log("Ready");
	rhit.fbAuthManager = new rhit.fbAuthManager();
	rhit.fbAuthManager.beginListening(() => {
		rhit.checkForRedirects();
		rhit.initializePage();
	});
  if (document.querySelector("#loginPage")) {
    new rhit.LoginPageController();
  }
};

rhit.main();