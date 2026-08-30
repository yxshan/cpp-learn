#include <iostream>
#include <string>

int main() {
    const std::string routes = "/health,/users";
    const auto position = routes.find("/admin");
    std::cout << "admin="
              << (position == std::string::npos ? "missing" : "enabled") << '\n';
}
