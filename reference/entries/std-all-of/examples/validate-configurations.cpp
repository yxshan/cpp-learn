#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Service {
    std::string name;
    int replicas;
};

int main() {
    const std::vector<Service> services{{"api", 3}, {"worker", 0}, {"web", 2}};
    const bool ready = std::all_of(services.begin(), services.end(),
                                   [](const Service& service) {
                                       return !service.name.empty() &&
                                              service.replicas > 0;
                                   });
    std::cout << std::boolalpha << "production-ready=" << ready << '\n';
}
