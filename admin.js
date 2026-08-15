const defaultItems=[
{id:1,title:"Class 10 Mathematics",className:"9th–10th",subject:"Mathematics",price:99,status:"published",description:"Chapter-wise revision notes, key concepts, formulas and practice-focused material.",file:""},
{id:2,title:"Class 10 Science",className:"9th–10th",subject:"Science",price:149,status:"published",description:"Revision-friendly notes covering important concepts and exam-oriented preparation.",file:""},
{id:3,title:"Class 10 Maths + Science",className:"9th–10th",subject:"2 Subjects",price:199,status:"published",description:"Combined premium study package for students preparing for board examinations.",file:""}];
let items=JSON.parse(localStorage.getItem("smarteredu_admin_items")||"null")||defaultItems;
const save=()=>{localStorage.setItem("smarteredu_admin_items",JSON.stringify(items));render();};
function render(){
 const pub=items.filter(x=>x.status==="published").length,draft=items.length-pub;
 document.querySelector("#statPublished").textContent=pub;document.querySelector("#statDrafts").textContent=draft;document.querySelector("#statTotal").textContent=items.length;
 const html=items.map(x=>`<div class="product"><div><h3>${esc(x.title)}</h3><p>${esc(x.className)} • ${esc(x.subject)}</p></div><span class="badge ${x.status}">${x.status==="published"?"Published":"Draft"}</span><span class="price">₹${Number(x.price).toLocaleString("en-IN")}</span><div class="actions"><button onclick="editItem(${x.id})">Edit</button> <button onclick="toggleItem(${x.id})">${x.status==="published"?"Unpublish":"Publish"}</button> <button onclick="deleteItem(${x.id})">Delete</button></div></div>`).join("")||"<div class='empty'>No premium content yet.</div>";
 document.querySelector("#dashList").innerHTML=html;document.querySelector("#contentList").innerHTML=html;
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function go(id){document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".side").forEach(x=>x.classList.remove("active"));document.querySelector("#"+id).classList.add("active");document.querySelector(`.side[data-tab="${id}"]`)?.classList.add("active")}
document.querySelectorAll(".side").forEach(b=>b.onclick=()=>go(b.dataset.tab));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
document.querySelector("#fFile").onchange=e=>document.querySelector("#fileName").textContent=e.target.files[0]?.name||"No file selected";
document.querySelector("#contentForm").onsubmit=e=>{e.preventDefault();items.push({id:Date.now(),title:fTitle.value,className:fClass.value,subject:fSubject.value,price:Number(fPrice.value),status:fStatus.value,description:fDesc.value,file:fFile.files[0]?.name||""});save();e.target.reset();document.querySelector("#fileName").textContent="No file selected";go("content")};
window.deleteItem=id=>{if(confirm("Delete this product from the browser prototype?")){items=items.filter(x=>x.id!==id);save()}};
window.toggleItem=id=>{const x=items.find(x=>x.id===id);x.status=x.status==="published"?"draft":"published";save()};
window.editItem=id=>{const x=items.find(x=>x.id===id);fTitle.value=x.title;fClass.value=x.className;fSubject.value=x.subject;fPrice.value=x.price;fDesc.value=x.description;fStatus.value=x.status;go("add");document.querySelector("#contentForm").onsubmit=e=>{e.preventDefault();Object.assign(x,{title:fTitle.value,className:fClass.value,subject:fSubject.value,price:Number(fPrice.value),status:fStatus.value,description:fDesc.value,file:fFile.files[0]?.name||x.file});save();e.target.reset();document.querySelector("#fileName").textContent="No file selected";go("content");document.querySelector("#contentForm").onsubmit=window.addHandler}};
const windowAdd=()=>{};
const form=document.querySelector("#contentForm");
const windowOriginalSubmit=form.onsubmit;
window.addHandler=windowOriginalSubmit;
render();