import { Sidebar } from "./components/sidebar";
import { Footer } from "./components/footer";
import { Messages } from "./components/messages";

function App() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex flex-col h-screen w-full overflow-hidden mx-auto bg-blue-100 gap-4">
        <Messages />
        <Footer />
      </div>
    </div>
  );
}

export default App;
