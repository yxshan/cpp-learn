#include <iostream>
#include <string>
#include <utility>

std::pair<std::string, int> fetch_status() {
    return {"ok", 200};
}

int main() {
    const auto [status, code] = fetch_status();
    std::cout << "status=" << status << " code=" << code << '\n';
}
