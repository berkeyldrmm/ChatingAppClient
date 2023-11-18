class ChatApp{
    static name="";
    static connectionId="";
    static color="";
    static toGroup=false;
    static to={};
    static messages=[];

    static stateAnimation(state) {
        state.fadeIn(2000, () => {
            setTimeout(() => {
                state.fadeOut();
            }, 2000)
        });
    }

    static displayMessageBox(name, connectionId){
        let html="";

        ChatApp.messages.forEach(message => {
            if((message.toGroup && message.to==connectionId) || (message.fromConnectionId==connectionId && message.to=="me") || (message.to==connectionId)){
                
                let position=(message.fromConnectionId!=ChatApp.connectionId) ? "chat-message-left" : "chat-message-right";
                let from=(message.fromConnectionId==ChatApp.connectionId) ? "Me" : message.fromName;
                let margin=(message.fromConnectionId==ChatApp.connectionId) ? "mr-3" : "ml-3";
                let color=(message.fromConnectionId==ChatApp.connectionId) ? ChatApp.color : message.fromColor;

                html+=`
                    <div class="${position} pb-4">
                        <div>
                            <div class="rounded-circle mr-1" style="background-color: ${color}; width: 40px; height: 40px;"></div>
                            <div class="text-muted small text-nowrap mt-2">${message.time}</div>
                        </div>
                        <div class="flex-shrink-1 bg-light rounded py-2 px-3 ${margin}">
                            <div class="font-weight-bold mb-1">${from}</div>
                            ${message.message}
                        </div>
                    </div>
                `;
            }

        });

        $("#messageContainer").html(html);
        $("#messageContainer").css("display","block");
        $("#receiver").html(name);
        console.log(ChatApp.to);
        setTimeout(()=>{
            if(ChatApp.to.Color!=null){
                $("#receiver").css("color", ChatApp.to.Color);
            }
            else{
                $("#receiver").css("color","black");
            }
        },10);
        
    }
}
class Message{
    constructor(fromName, fromColor, fromConnectionId, message, to, toGroup, time){
        this.fromName=fromName;
        this.fromColor=fromColor;
        this.fromConnectionId=fromConnectionId;
        this.message=message;
        this.to=to;
        this.toGroup=toGroup;
        this.time=time;
    }
}

const connection = new signalR.HubConnectionBuilder().withAutomaticReconnect().withUrl("https://localhost:44319/chatHub", {
    skipNegotiation: true,
    transport: signalR.HttpTransportType.WebSockets
}).build();

$(document).ready(() => {

    $("#subscribe").click(e => {
        var state = $("#state");
        var personSelect = $("#person-select");
        var groupSelect = $("#group-select");
        var send=$("#sendMessage");

        start(state, personSelect, groupSelect);

        $("#addGroup").click(()=>{
            $("#modal").css("display", "flex");
            $("#createGroup").click(()=>{
                var clientForGroup = $("input[type=checkbox][name=clientsForGroup]:checked");
                var groupName=$("#groupName").val();
                var checkedClients = [];
                clientForGroup.each(function(){
                    checkedClients.push($(this).val());
                });
                connection.invoke("addGroup", groupName, JSON.stringify(checkedClients));
                closeModal();
                e.preventDefault();
            });
            
            e.preventDefault();
        });

        send.click(()=>{
            let message = $("#message").val();
            $("#message").val("");
            let to= (ChatApp.toGroup) ? ChatApp.to.GroupName : ChatApp.to.ConnectionId;
            connection.invoke("receiveMessage", message, ChatApp.toGroup, to);
            ChatApp.messages.push(new Message(ChatApp.name, ChatApp.color, ChatApp.connectionId, message, to, ChatApp.toGroup, new Date().toLocaleTimeString()));
            if(ChatApp.toGroup){
                ChatApp.displayMessageBox(groupSelect.find(":selected").val(), groupSelect.val());
            }
            else{
                ChatApp.displayMessageBox(personSelect.find(":selected").html(), personSelect.val());
            }
        })

        personSelect.change(() => {
            if(personSelect.val()!="-1"){
                ChatApp.toGroup=false;
                connection.invoke("getClient", personSelect.find(":selected").val());
                ChatApp.displayMessageBox(personSelect.find(":selected").html(), personSelect.val());
            }
        })

        groupSelect.change(() => {
            if(groupSelect.val()!="-1"){
                ChatApp.toGroup=true;
                connection.invoke("getGroup", groupSelect.find(":selected").val());
                ChatApp.displayMessageBox(groupSelect.find(":selected").val(), groupSelect.val());
            }
        })

        e.preventDefault();
    })

    async function start(state, personSelect, groupSelect) {
        try {
            await connection.start();
            ChatApp.name = $("#name").val();
            ChatApp.color = $("#color").val();

            $("#subscribeContainer").css("display", "none");
            $("#chatContainer").css("display", "block");
            $("#chatContainer>h1").html(`Welcome ${ChatApp.name}`);
            $("#chatContainer>h1").css("background-color", ChatApp.color);

            connection.invoke("addClient", ChatApp.name, ChatApp.color);

            connection.on("JoinToChat", (connectionId) => {
                ChatApp.connectionId=connectionId;
            });

            connection.on("UserJoin", (name2) => {
                state.css("background-color", "green");
                state.html("<p> " + name2 + " sohbete katıldı.</p><br>");
                ChatApp.stateAnimation(state);
            });

            connection.on("Clients", (clients_json) => {
                var clientsForGroup=$("#clientsForGroup");
                var clients = JSON.parse(clients_json);
                let html = '<option selected value="-1">Select the person</option>';
                let html2 = '<li class="list-group-item"><h2>Clients</h2></li>';
                $.each(clients, (index, item) => {
                    if (item.ConnectionId != ChatApp.connectionId){
                        html += `
                            <option value="${item.ConnectionId}">${item.Name}</option>
                        `;
                        html2 += `
                            <li class="list-group-item">
                                <input class="form-check-input me-1" name="clientsForGroup" type="checkbox" value=${item.ConnectionId}>
                                ${item.Name}
                            </li>
                        `;
                    }
                });
                personSelect.html(html);
                clientsForGroup.html(html2);
            });

            connection.on("Groups", (groups_json) => {
                var groups = JSON.parse(groups_json);
                var html = '<option selected value="-1">Select the group</option>';
                $.each(groups, (index, group) => {
                    $.each(group.clients, (index, client)=>{
                        if(ChatApp.connectionId==client.ConnectionId){
                            html += `
                                <option value="${group.GroupName}">${group.GroupName}</option>
                            `;
                        }
                    })
                })
                groupSelect.html(html);
            });

            connection.on("GetClientOrGroup", json=>{
                var c = JSON.parse(json);
                ChatApp.to = c;
            });

            connection.on("UserLeave", name2 => {
                state.css("background-color", "red");
                state.html("<p> " + name2 + " sohbetten ayrıldı..</p><br>");
                ChatApp.stateAnimation(state);
            });

            connection.on("SendMessage", (textMessage, toGroup, from_json, groupName) => {
                console.log("mesaj alındı..");
                let from=JSON.parse(from_json);
                let to= (toGroup) ? groupName : "me" ;
                if(from.Name!=ChatApp.name)
                    ChatApp.messages.push(new Message(from.Name, from.Color, from.ConnectionId, textMessage, to, toGroup, new Date().toLocaleTimeString()));
                
                if(ChatApp.toGroup){
                    ChatApp.displayMessageBox(groupSelect.find(":selected").val(), groupSelect.val());
                }
                else{
                    ChatApp.displayMessageBox(personSelect.find(":selected").html(), personSelect.val());
                }
                console.log(ChatApp.messages);
            });

            connection.on("Error", message=>{
                state.html(message);
                ChatApp.stateAnimation();
            })

            connection.onreconnecting(error => {
                state.css("background-color", "grey");
                state.css("color", "white");
                state.html("Bağlantı kuruluyor... " + error);
                ChatApp.stateAnimation();
            });
    
            connection.onreconnected(connectionId => {
                state.css("background-color", "green");
                state.css("color", "white");
                state.html("Bağlantı kuruldu...");
                ChatApp.stateAnimation();
            });
    
            connection.onclose(connectionId => {
                state.css("background-color", "red");
                state.css("color", "white");
                state.html("Bağlantı kurulamadı...");
                ChatApp.stateAnimation();
            });

        } catch (error) {
            //connection.stop();
            setTimeout(() => {
                start();
                console.error(error);
            }, 2000);
        }
    }
});

function closeModal(){
    $("#modal").css("display","none");
}
