import { Sidebar } from "./components/sidebar";
import { Footer } from "./components/footer";
import { Messages } from "./components/messages";

function App() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex flex-col justify-between h-screen w-full overflow-hidden mx-auto bg-blue-100/50">
        <Messages />
        <Footer />
      </div>
    </div>
  );
}

export default App;
