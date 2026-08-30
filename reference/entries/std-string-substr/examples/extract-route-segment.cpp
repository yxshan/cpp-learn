#include <iostream>
#include <string>

int main() {
    const std::string route = "/api/users/42";
    const auto start = route.find("users");
    if (start != std::string::npos) {
        const auto end = route.find('/', start);
        const std::string resource = route.substr(start, end - start);
        std::cout << "resource=" << resource << '\n';
    }
}
